import { prisma } from '../lib/prisma.js';
import type { Prisma } from '@prisma/client';
import type { DomainContext } from '../domain/domain-context.js';
import { DomainError } from '../domain/domain-error.js';
import { assertTransition, BOOKING_TRANSITIONS, type BookingStatus } from '../domain/transitions.js';
import { writeAuditEvent } from './audit.service.js';

export interface CreateBookingInput {
  leadId: string;
  at: Date;
}

export interface BookingListOptions {
  limit: number;
  offset: number;
  status?: BookingStatus;
}

export class BookingService {
  async list(context: DomainContext, options: BookingListOptions) {
    const where: Prisma.BookingWhereInput = {
      organizationId: context.organizationId,
      ...(options.status ? { status: options.status } : {}),
    };
    const [data, total] = await Promise.all([
      prisma.booking.findMany({
        where,
        orderBy: { at: 'asc' },
        skip: options.offset,
        take: options.limit,
      }),
      prisma.booking.count({ where }),
    ]);
    return { data, total };
  }

  async get(context: DomainContext, bookingId: string) {
    const booking = await prisma.booking.findFirst({
      where: { id: bookingId, organizationId: context.organizationId },
    });
    if (!booking) throw new DomainError('NOT_FOUND', 'Booking not found');
    return booking;
  }

  async create(context: DomainContext, input: CreateBookingInput) {
    const lead = await prisma.leadProfile.findFirst({
      where: { id: input.leadId, organizationId: context.organizationId },
    });
    if (!lead) throw new DomainError('NOT_FOUND', 'Lead not found');

    const booking = await prisma.booking.create({
      data: {
        organizationId: context.organizationId,
        leadId: lead.id,
        at: input.at,
        status: 'pending',
      },
    });
    await writeAuditEvent(context, 'BOOKING_CREATED', {
      bookingId: booking.id,
      leadId: lead.id,
      at: input.at.toISOString(),
    });
    return booking;
  }

  async transitionStatus(context: DomainContext, bookingId: string, to: BookingStatus) {
    const booking = await this.get(context, bookingId);
    assertTransition(BOOKING_TRANSITIONS, booking.status as BookingStatus, to, 'booking status');
    const updated = await prisma.booking.update({
      where: { id: booking.id },
      data: { status: to },
    });
    await writeAuditEvent(context, 'BOOKING_STATUS_CHANGED', {
      bookingId: booking.id,
      from: booking.status,
      to,
    });
    return updated;
  }
}