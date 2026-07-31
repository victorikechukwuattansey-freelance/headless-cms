import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { prisma } from "@awd/database";
import { validateGraph } from "@awd/workflow-engine";
import { NODE_TYPES } from "@awd/workflow-engine";
import { QueueService } from "../queue/queue.service";
import { randomBytes } from "node:crypto";

export interface GraphPayload {
  nodes: Array<{
    id: string;
    nodeType: string;
    positionX?: number;
    positionY?: number;
    configuration?: Record<string, unknown>;
  }>;
  connections: Array<{
    id?: string;
    sourceNode: string;
    targetNode: string;
  }>;
}

export interface WorkflowListItem {  id: string;
  name: string;
  description: string | null;
  status: string;
  triggerType: string;
  scheduleCron: string | null;
  currentVersion: number;
  updatedAt: Date;
}

export interface WorkflowDetailItem extends WorkflowListItem {
  version: {
    version: number;
    nodes: Array<{
      id: string;
      nodeType: string;
      positionX: number;
      positionY: number;
      configuration: Record<string, unknown>;
    }>;
    connections: Array<{
      id: string;
      sourceNode: string;
      targetNode: string;
    }>;
  } | null;
}

function canonicalEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null || typeof a !== "object" || typeof b !== "object") return false;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((item, i) => canonicalEqual(item, b[i]));
  }
  const ka = Object.keys(a as Record<string, unknown>).sort();
  const kb = Object.keys(b as Record<string, unknown>).sort();
  if (ka.length !== kb.length) return false;
  return ka.every((k, i) => kb[i] === k && canonicalEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
}

@Injectable()
export class WorkflowsService {
  constructor(private readonly queue: QueueService) {}

  async list(organizationId: string): Promise<WorkflowListItem[]> {
    const workflows = await prisma.workflow.findMany({
      where: { organizationId, deletedAt: null },
      orderBy: { updatedAt: "desc" },
    });
    return workflows.map((w) => ({
      id: w.id,
      name: w.name,
      description: w.description,
      status: w.status,
      triggerType: w.triggerType,
      scheduleCron: w.scheduleCron,
      currentVersion: w.currentVersion,
      updatedAt: w.updatedAt,
    }));
  }

  async get(organizationId: string, workflowId: string): Promise<WorkflowDetailItem | null> {
    const workflow = await prisma.workflow.findFirst({
      where: { id: workflowId, organizationId, deletedAt: null },
      include: {
        versions: {
          orderBy: { version: "desc" },
          take: 1,
          include: { nodes: { orderBy: { nodeKey: "asc" } }, connections: true },
        },
      },
    });
    if (!workflow) throw new NotFoundException("Workflow not found");
    const version = workflow.versions[0];
    return {
      id: workflow.id,
      name: workflow.name,
      description: workflow.description,
      status: workflow.status,
      triggerType: workflow.triggerType,
      scheduleCron: workflow.scheduleCron,
      currentVersion: workflow.currentVersion,
      updatedAt: workflow.updatedAt,
      version: version
        ? {
            version: version.version,
            nodes: version.nodes.map((n) => ({
              id: n.nodeKey,
              nodeType: n.nodeType,
              positionX: n.positionX,
              positionY: n.positionY,
              configuration: (n.configuration as Record<string, unknown>) ?? {},
            })),
            connections: version.connections.map((c) => ({
              id: c.id,
              sourceNode: c.sourceNode,
              targetNode: c.targetNode,
            })),
          }
        : null,
    };
  }

  async create(
    organizationId: string,
    userId: string,
    payload: { name: string; description?: string; scheduleCron?: string | null; graph: GraphPayload },
  ): Promise<WorkflowDetailItem | null> {
    const issues = validateGraph(
      {
        nodes: (payload.graph.nodes ?? []).map((n) => ({
          id: n.id,
          nodeType: n.nodeType,
          category: "TRIGGER" as const,
          positionX: n.positionX ?? 0,
          positionY: n.positionY ?? 0,
          configuration: n.configuration ?? {},
        })),
        connections: (payload.graph.connections ?? []).map((c) => ({
          id: c.id ?? `${c.sourceNode}-${c.targetNode}`,
          sourceNode: c.sourceNode,
          targetNode: c.targetNode,
          sourcePort: "out",
          targetPort: "in",
        })),
      },
      NODE_TYPES,
    );
    if (!issues.valid) {
      throw new BadRequestException(`Invalid graph: ${issues.issues.map((i) => i.message).join("; ")}`);
    }

    const triggerType = (payload.graph.nodes ?? []).some((n) => n.nodeType === "schedule-trigger")
      ? "SCHEDULE"
      : (payload.graph.nodes ?? []).some((n) => n.nodeType === "webhook-trigger")
        ? "WEBHOOK"
        : "MANUAL";

    if (triggerType === "SCHEDULE" && !payload.scheduleCron) {
      const cronNode = (payload.graph.nodes ?? []).find((n) => n.nodeType === "schedule-trigger");
      const nodeCron = cronNode?.configuration?.cron;
      if (typeof nodeCron === "string" && nodeCron.trim()) payload.scheduleCron = nodeCron;
    }

    let createdId = "";
    await prisma.$transaction(async (tx) => {
      const workflow = await tx.workflow.create({
        data: {
          organizationId,
          name: payload.name,
          description: payload.description,
          createdById: userId,
          updatedById: userId,
          triggerType,
          scheduleCron: triggerType === "SCHEDULE" ? (payload.scheduleCron ?? null) : null,
          webhookToken: triggerType === "WEBHOOK" ? randomBytes(24).toString("hex") : null,
          status: "DRAFT",
        },
      });
      createdId = workflow.id;
      const version = await tx.workflowVersion.create({
        data: {
          workflowId: workflow.id,
          version: 1,
          schemaVersion: 1,
          checksum: "sha256:not-computed",
          definition: payload.graph as unknown as object,
          publishedById: userId,
          publishedAt: new Date(),
        },
      });
      for (const node of payload.graph.nodes ?? []) {
        await tx.workflowNode.create({
          data: {
            workflowVersionId: version.id,
            nodeKey: node.id,
            nodeType: node.nodeType,
            category: "TRIGGER",
            positionX: node.positionX ?? 0,
            positionY: node.positionY ?? 0,
            configuration: (node.configuration ?? {}) as object,
          },
        });
      }
      for (const conn of payload.graph.connections ?? []) {
        await tx.workflowConnection.create({
          data: {
            workflowVersionId: version.id,
            sourceNode: conn.sourceNode,
            targetNode: conn.targetNode,
            sourcePort: "out",
            targetPort: "in",
          },
        });
      }
      await tx.workflow.update({
        where: { id: workflow.id },
        data: { currentVersion: 1 },
      });
    });
    return this.get(organizationId, createdId);
  }

  async update(
    organizationId: string,
    workflowId: string,
    userId: string,
    payload: { name?: string; description?: string; graph: GraphPayload; scheduleCron?: string | null },
  ): Promise<WorkflowDetailItem | null> {
    const workflow = await prisma.workflow.findFirst({
      where: { id: workflowId, organizationId, deletedAt: null },
    });
    if (!workflow) throw new NotFoundException("Workflow not found");

    const issues = validateGraph(
      {
        nodes: (payload.graph.nodes ?? []).map((n) => ({
          id: n.id,
          nodeType: n.nodeType,
          category: "TRIGGER" as const,
          positionX: n.positionX ?? 0,
          positionY: n.positionY ?? 0,
          configuration: n.configuration ?? {},
        })),
        connections: (payload.graph.connections ?? []).map((c) => ({
          id: c.id ?? `${c.sourceNode}-${c.targetNode}`,
          sourceNode: c.sourceNode,
          targetNode: c.targetNode,
          sourcePort: "out",
          targetPort: "in",
        })),
      },
      NODE_TYPES,
    );
    if (!issues.valid) {
      throw new BadRequestException(`Invalid graph: ${issues.issues.map((i) => i.message).join("; ")}`);
    }

    const triggerType = (payload.graph.nodes ?? []).some((n) => n.nodeType === "schedule-trigger")
      ? "SCHEDULE"
      : (payload.graph.nodes ?? []).some((n) => n.nodeType === "webhook-trigger")
        ? "WEBHOOK"
        : "MANUAL";

    const hasChanges = workflow.name !== (payload.name ?? workflow.name)
      || workflow.description !== (payload.description ?? workflow.description)
      || workflow.scheduleCron !== (payload.scheduleCron ?? workflow.scheduleCron)
      || workflow.triggerType !== triggerType;

    await prisma.$transaction(async (tx) => {
      const current = await tx.workflowVersion.findFirst({
        where: { workflowId, version: workflow.currentVersion },
        include: { nodes: true, connections: true },
      });

      const sameGraph = current !== null
        && current.nodes.length === (payload.graph.nodes ?? []).length
        && current.connections.length === (payload.graph.connections ?? []).length
        && current.nodes.every((n) => {
          const incoming = (payload.graph.nodes ?? []).find((p) => p.id === n.nodeKey);
          return incoming
            && incoming.nodeType === n.nodeType
            && (incoming.positionX ?? 0) === n.positionX
            && (incoming.positionY ?? 0) === n.positionY
            && canonicalEqual(incoming.configuration ?? {}, n.configuration ?? {});
        })
        && current.connections.every((c) =>
          (payload.graph.connections ?? []).some(
            (p) => p.sourceNode === c.sourceNode && p.targetNode === c.targetNode,
          ),
        );

      const nextVersion = hasChanges || !sameGraph ? workflow.currentVersion + 1 : workflow.currentVersion;
      if (nextVersion > workflow.currentVersion) {
        const version = await tx.workflowVersion.create({
          data: {
            workflowId,
            version: nextVersion,
            schemaVersion: 1,
            checksum: "sha256:not-computed",
            definition: payload.graph as unknown as object,
            publishedById: null,
            publishedAt: null,
          },
        });
        for (const node of payload.graph.nodes ?? []) {
          await tx.workflowNode.create({
            data: {
              workflowVersionId: version.id,
              nodeKey: node.id,
              nodeType: node.nodeType,
              category: "TRIGGER",
              positionX: node.positionX ?? 0,
              positionY: node.positionY ?? 0,
              configuration: (node.configuration ?? {}) as object,
            },
          });
        }
        for (const conn of payload.graph.connections ?? []) {
          await tx.workflowConnection.create({
            data: {
              workflowVersionId: version.id,
              sourceNode: conn.sourceNode,
              targetNode: conn.targetNode,
              sourcePort: "out",
              targetPort: "in",
            },
          });
        }
      }
      await tx.workflow.update({
        where: { id: workflowId },
        data: {
          name: payload.name ?? workflow.name,
          description: payload.description ?? workflow.description,
          triggerType,
          scheduleCron: triggerType === "SCHEDULE" ? (payload.scheduleCron ?? workflow.scheduleCron) : null,
          currentVersion: nextVersion,
          updatedById: userId,
          status: nextVersion > workflow.currentVersion ? "DRAFT" : workflow.status,
        },
      });
    });
    return this.get(organizationId, workflowId);
  }

  async remove(organizationId: string, workflowId: string): Promise<{ deleted: boolean }> {
    const workflow = await prisma.workflow.findFirst({
      where: { id: workflowId, organizationId, deletedAt: null },
    });
    if (!workflow) throw new NotFoundException("Workflow not found");
    await prisma.workflow.update({
      where: { id: workflowId },
      data: { deletedAt: new Date() },
    });
    return { deleted: true };
  }

  async publish(organizationId: string, workflowId: string): Promise<{ id: string; status: string; publishedAt: Date | null }> {
    const workflow = await prisma.workflow.findFirst({
      where: { id: workflowId, organizationId, deletedAt: null },
    });
    if (!workflow) throw new NotFoundException("Workflow not found");
    const updated = await prisma.$transaction(async (tx) => {
      const version = await tx.workflowVersion.findFirst({
        where: { workflowId, version: workflow.currentVersion },
        orderBy: { version: "desc" },
      });
      if (version) {
        await tx.workflowVersion.update({
          where: { id: version.id },
          data: { publishedById: workflow.updatedById, publishedAt: new Date() },
        });
      }
      return tx.workflow.update({
        where: { id: workflowId },
        data: { status: "PUBLISHED", publishedAt: new Date() },
      });
    });
    return { id: updated.id, status: updated.status, publishedAt: updated.publishedAt };
  }

  async run(organizationId: string, workflowId: string, input: Record<string, unknown>): Promise<{ executionId: string; status: string }> {
    const workflow = await prisma.workflow.findFirst({
      where: { id: workflowId, organizationId, deletedAt: null },
    });
    if (!workflow) throw new NotFoundException("Workflow not found");
    const execution = await prisma.execution.create({
      data: {
        organizationId,
        workflowId,
        workflowVersion: workflow.currentVersion,
        status: "QUEUED",
        trigger: "MANUAL",
        input: input as object,
        correlationId: `manual:${workflowId}:${Date.now()}`,
      },
    });
    await this.queue.enqueue({
      executionId: execution.id,
      workflowId: execution.workflowId,
      organizationId,
      trigger: "MANUAL",
      input,
      correlationId: execution.correlationId,
    });
    return { executionId: execution.id, status: "QUEUED" };
  }
}
