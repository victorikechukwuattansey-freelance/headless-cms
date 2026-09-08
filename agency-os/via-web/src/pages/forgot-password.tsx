import { useState } from "react";
import { useLocation, Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useForgotPassword } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ShieldHalf, Loader2, MailCheck } from "lucide-react";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

const forgotSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

export default function ForgotPassword() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const forgotMutation = useForgotPassword();
  const [isSuccess, setIsSuccess] = useState(false);

  const form = useForm<z.infer<typeof forgotSchema>>({
    resolver: zodResolver(forgotSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = async (values: z.infer<typeof forgotSchema>) => {
    try {
      await forgotMutation.mutateAsync({ data: values });
      setIsSuccess(true);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Request Failed",
        description: error.data?.message || "Failed to send reset email",
      });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex flex-col items-center justify-center text-center space-y-2">
          <div className="p-3 bg-orange-500/10 rounded-2xl">
            <ShieldHalf className="h-10 w-10 text-orange-500" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">ACCESS_CTRL</h1>
        </div>

        <Card className="border-0 shadow-xl shadow-slate-200/50">
          <CardHeader>
            <CardTitle>Reset Password</CardTitle>
            <CardDescription>Enter your email to receive a password reset link</CardDescription>
          </CardHeader>
          <CardContent>
            {isSuccess ? (
              <div className="flex flex-col items-center justify-center py-6 text-center space-y-4">
                <div className="h-12 w-12 rounded-full bg-teal-100 flex items-center justify-center">
                  <MailCheck className="h-6 w-6 text-teal-600" />
                </div>
                <div className="space-y-2">
                  <h3 className="font-medium text-slate-900">Check your email</h3>
                  <p className="text-sm text-slate-500">
                    We've sent password reset instructions to your email address.
                  </p>
                </div>
              </div>
            ) : (
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input placeholder="name@example.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="w-full bg-slate-900 hover:bg-slate-800" disabled={forgotMutation.isPending}>
                    {forgotMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Send Reset Link
                  </Button>
                </form>
              </Form>
            )}
          </CardContent>
          <CardFooter className="flex flex-col border-t border-slate-100 pt-6">
            <div className="text-sm text-center text-slate-500">
              Remember your password?{" "}
              <Link href="/login" className="text-orange-600 hover:underline font-medium">
                Back to login
              </Link>
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
