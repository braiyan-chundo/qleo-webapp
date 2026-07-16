import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router-dom';
import { REGEXP_ONLY_DIGITS } from 'input-otp';
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  Eye,
  EyeOff,
  Lock,
  Mail,
  RotateCcw,
  ShieldCheck,
} from 'lucide-react';

import { QleoLogo } from '@/shared/components/QleoLogo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { ApiError } from '@/core/api/fetch-client';

import {
  newPasswordSchema,
  PASSWORD_REQUIREMENTS,
  requestResetSchema,
  verifyOtpSchema,
  type NewPasswordValues,
  type RequestResetValues,
  type VerifyOtpValues,
} from '../schemas/password-reset.schema';
import {
  useConfirmPasswordReset,
  useRequestPasswordReset,
  useVerifyPasswordResetOtp,
} from '../hooks/use-password-reset';

/** Cooldown de reenvío del código, en segundos (coincide con el backend, §3.30). */
const RESEND_COOLDOWN_SECONDS = 60;

/** Mensaje genérico anti-enumeración: se muestra pase lo que pase tras `request`. */
const GENERIC_REQUEST_MESSAGE =
  'Si el correo está registrado, te enviamos un código para restablecer la contraseña.';

type Step = 'email' | 'code' | 'password';

/** Mapea un error de OTP (`ApiError.code`, §3.30) a un mensaje y si conviene pedir otro código. */
function mapOtpError(error: unknown): { message: string; needsNewCode: boolean } | null {
  if (!error) return null;
  if (error instanceof ApiError) {
    switch (error.code) {
      case 'OTP_INVALID':
        return { message: 'El código es incorrecto. Revísalo e inténtalo de nuevo.', needsNewCode: false };
      case 'OTP_EXPIRED':
        return { message: 'El código caducó. Solicita uno nuevo para continuar.', needsNewCode: true };
      case 'OTP_ATTEMPTS_EXCEEDED':
        return { message: 'Agotaste los intentos permitidos. Solicita un código nuevo.', needsNewCode: true };
      default:
        return { message: error.message, needsNewCode: false };
    }
  }
  if (error instanceof Error) return { message: error.message, needsNewCode: false };
  return { message: 'Ocurrió un error. Inténtalo de nuevo.', needsNewCode: false };
}

/**
 * Página "¿Olvidaste tu contraseña?" (recuperación por OTP, §3.30). Tres pasos en una sola
 * página con estado local: correo → código → nueva contraseña. Al confirmar, el backend
 * devuelve el mismo `AuthResponse` del login y el hook inicia sesión automáticamente. Todo
 * dato del servidor pasa por TanStack Query (hooks `use-password-reset`); aquí solo estado
 * de UI. Estilo alineado con `LoginPage`/`AuthLayout` (tokens Material 3).
 */
export function ForgotPasswordPage() {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [verifiedCode, setVerifiedCode] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [showPassword, setShowPassword] = useState(false);

  const requestMutation = useRequestPasswordReset();
  const verifyMutation = useVerifyPasswordResetOtp();
  const confirmMutation = useConfirmPasswordReset();

  const emailForm = useForm<RequestResetValues>({
    resolver: zodResolver(requestResetSchema),
    defaultValues: { email: '' },
  });
  const codeForm = useForm<VerifyOtpValues>({
    resolver: zodResolver(verifyOtpSchema),
    defaultValues: { code: '' },
  });
  const passwordForm = useForm<NewPasswordValues>({
    resolver: zodResolver(newPasswordSchema),
    defaultValues: { newPassword: '', confirmPassword: '' },
  });

  // Cuenta regresiva del reenvío. Se rearma cada vez que `cooldown` baja de 0.
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((current) => (current <= 1 ? 0 : current - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const watchedPassword = passwordForm.watch('newPassword');
  const watchedCode = codeForm.watch('code');
  const verifyErrorInfo = mapOtpError(verifyMutation.error);
  const confirmErrorInfo = mapOtpError(confirmMutation.error);

  // Paso 1 → pide el código y avanza al paso del código (siempre, mensaje genérico).
  const onSubmitEmail = (values: RequestResetValues) => {
    requestMutation.mutate(
      { email: values.email },
      {
        onSuccess: () => {
          setEmail(values.email);
          setCooldown(RESEND_COOLDOWN_SECONDS);
          setStep('code');
        },
      },
    );
  };

  // Reenvío del código (respeta el cooldown de 60 s del backend).
  const handleResend = () => {
    if (cooldown > 0 || requestMutation.isPending) return;
    verifyMutation.reset();
    requestMutation.mutate(
      { email },
      { onSuccess: () => setCooldown(RESEND_COOLDOWN_SECONDS) },
    );
  };

  // Paso 2 → valida el OTP (sin consumirlo) y avanza al paso de la contraseña.
  const onSubmitCode = (values: VerifyOtpValues) => {
    verifyMutation.mutate(
      { email, code: values.code },
      {
        onSuccess: () => {
          setVerifiedCode(values.code);
          setStep('password');
        },
      },
    );
  };

  // Paso 3 → aplica la nueva contraseña; el hook hace auto-login + navegación.
  const onSubmitPassword = (values: NewPasswordValues) => {
    confirmMutation.mutate({
      email,
      code: verifiedCode,
      newPassword: values.newPassword,
    });
  };

  // Vuelve al paso del correo para pedir un código nuevo (código caducado / intentos agotados).
  const handleRequestNewCode = () => {
    verifyMutation.reset();
    confirmMutation.reset();
    codeForm.reset({ code: '' });
    passwordForm.reset({ newPassword: '', confirmPassword: '' });
    setVerifiedCode('');
    setCooldown(0);
    setStep('email');
  };

  const stepDescription =
    step === 'email'
      ? 'Ingresa tu correo y te enviaremos un código de verificación.'
      : step === 'code'
        ? `Escribe el código de 6 dígitos que enviamos a ${email}.`
        : 'Crea una contraseña nueva y segura para tu cuenta.';

  return (
    <Card className="rounded-[24px] shadow-[0_8px_40px_-12px_rgba(0,0,0,0.1)] border border-outline-variant/30 ring-0 w-full animate-in fade-in zoom-in-95 duration-500 p-0 overflow-visible">
      <CardHeader className="text-center pt-5 sm:pt-6 px-8 sm:px-10 pb-0 gap-1.5 sm:gap-2.5">
        <CardTitle className="flex justify-center">
          <QleoLogo
            beta
            size={36}
            markClassName="sm:size-11"
            className="gap-3 text-primary dark:text-inverse-primary dark:glow-text"
            textClassName="text-3xl sm:text-4xl font-extrabold tracking-tight"
          />
        </CardTitle>
        <CardDescription className="text-sm text-on-surface-variant font-medium">
          {stepDescription}
        </CardDescription>
      </CardHeader>

      <CardContent className="px-8 sm:px-10 py-4 sm:py-5">
        {/* ─────────────── Paso 1: correo ─────────────── */}
        {step === 'email' && (
          <form onSubmit={emailForm.handleSubmit(onSubmitEmail)} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="block text-xs font-medium text-on-surface ml-1" htmlFor="reset-email">
                Correo electrónico
              </Label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="w-5 h-5 text-outline" />
                </div>
                <Input
                  id="reset-email"
                  type="email"
                  placeholder="ejemplo@agencia.com"
                  autoComplete="email"
                  {...emailForm.register('email')}
                  className="w-full h-11 sm:h-12 pl-10 pr-4 bg-surface-bright border-outline-variant/60 rounded-xl text-sm text-on-surface placeholder:text-outline-variant/80 focus-visible:ring-primary/20 focus-visible:border-primary transition-all duration-200"
                />
              </div>
              {emailForm.formState.errors.email && (
                <span className="text-xs font-medium text-error ml-1">
                  {emailForm.formState.errors.email.message}
                </span>
              )}
            </div>

            <Button
              type="submit"
              disabled={requestMutation.isPending}
              className="w-full h-12 sm:h-13 rounded-xl shadow-sm text-base font-semibold text-on-primary bg-primary hover:bg-on-primary-fixed-variant mt-2"
            >
              {requestMutation.isPending ? 'Enviando…' : 'Enviar código'}
            </Button>
          </form>
        )}

        {/* ─────────────── Paso 2: código OTP ─────────────── */}
        {step === 'code' && (
          <form onSubmit={codeForm.handleSubmit(onSubmitCode)} className="space-y-4">
            {/* Aviso genérico anti-enumeración (§3.30). */}
            <div className="p-3 bg-surface-container-low text-on-surface-variant rounded-xl text-xs font-medium flex items-start gap-2 border border-outline-variant/30">
              <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5 text-primary" />
              <span>{GENERIC_REQUEST_MESSAGE}</span>
            </div>

            <div className="space-y-2">
              <Label className="block text-xs font-medium text-on-surface ml-1 text-center">
                Código de verificación
              </Label>
              <Controller
                control={codeForm.control}
                name="code"
                render={({ field }) => (
                  <InputOTP
                    maxLength={6}
                    pattern={REGEXP_ONLY_DIGITS}
                    inputMode="numeric"
                    autoFocus
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    containerClassName="justify-center gap-2"
                  >
                    <InputOTPGroup className="gap-2">
                      {[0, 1, 2, 3, 4, 5].map((index) => (
                        <InputOTPSlot
                          key={index}
                          index={index}
                          className="size-11 sm:size-12 rounded-xl border-l text-lg font-semibold"
                        />
                      ))}
                    </InputOTPGroup>
                  </InputOTP>
                )}
              />
              {codeForm.formState.errors.code && (
                <span className="block text-center text-xs font-medium text-error">
                  {codeForm.formState.errors.code.message}
                </span>
              )}
            </div>

            {/* Error de verificación mapeado por código (§3.30). */}
            {verifyErrorInfo && (
              <div className="p-3 bg-error-container text-on-error-container rounded-xl text-xs font-medium border border-error/20 space-y-2">
                <p>{verifyErrorInfo.message}</p>
                {verifyErrorInfo.needsNewCode && (
                  <button
                    type="button"
                    onClick={handleRequestNewCode}
                    className="font-semibold text-error hover:underline underline-offset-2"
                  >
                    Solicitar un código nuevo
                  </button>
                )}
              </div>
            )}

            <Button
              type="submit"
              disabled={verifyMutation.isPending || watchedCode.length !== 6}
              className="w-full h-12 sm:h-13 rounded-xl shadow-sm text-base font-semibold text-on-primary bg-primary hover:bg-on-primary-fixed-variant"
            >
              {verifyMutation.isPending ? 'Verificando…' : 'Verificar código'}
            </Button>

            {/* Reenviar código con cuenta regresiva de 60 s. */}
            <div className="flex items-center justify-between text-xs">
              <button
                type="button"
                onClick={handleRequestNewCode}
                className="font-medium text-on-surface-variant hover:text-on-surface transition-colors"
              >
                Cambiar correo
              </button>
              <button
                type="button"
                onClick={handleResend}
                disabled={cooldown > 0 || requestMutation.isPending}
                className="inline-flex items-center gap-1 font-medium text-primary transition-colors hover:underline underline-offset-2 disabled:text-outline disabled:no-underline disabled:cursor-not-allowed"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                {cooldown > 0 ? `Reenviar en ${cooldown}s` : 'Reenviar código'}
              </button>
            </div>
          </form>
        )}

        {/* ─────────────── Paso 3: nueva contraseña ─────────────── */}
        {step === 'password' && (
          <form onSubmit={passwordForm.handleSubmit(onSubmitPassword)} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="block text-xs font-medium text-on-surface ml-1" htmlFor="new-password">
                Nueva contraseña
              </Label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="w-5 h-5 text-outline" />
                </div>
                <Input
                  id="new-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  {...passwordForm.register('newPassword')}
                  className="w-full h-11 sm:h-12 pl-10 pr-10 bg-surface-bright border-outline-variant/60 rounded-xl text-sm text-on-surface placeholder:text-outline-variant/80 focus-visible:ring-primary/20 focus-visible:border-primary transition-all duration-200"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-outline hover:text-on-surface transition-colors focus:outline-none"
                >
                  {showPassword ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Lista de requisitos de la contraseña fuerte, en vivo. */}
            <ul className="space-y-1.5 ml-1">
              {PASSWORD_REQUIREMENTS.map((req) => {
                const met = req.test(watchedPassword);
                return (
                  <li
                    key={req.id}
                    className={`flex items-center gap-2 text-xs font-medium transition-colors ${
                      met ? 'text-primary' : 'text-on-surface-variant'
                    }`}
                  >
                    {met ? (
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                    ) : (
                      <Circle className="w-4 h-4 shrink-0 text-outline-variant" />
                    )}
                    {req.label}
                  </li>
                );
              })}
            </ul>

            <div className="space-y-1.5">
              <Label className="block text-xs font-medium text-on-surface ml-1" htmlFor="confirm-password">
                Confirmar contraseña
              </Label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="w-5 h-5 text-outline" />
                </div>
                <Input
                  id="confirm-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  {...passwordForm.register('confirmPassword')}
                  className="w-full h-11 sm:h-12 pl-10 pr-4 bg-surface-bright border-outline-variant/60 rounded-xl text-sm text-on-surface placeholder:text-outline-variant/80 focus-visible:ring-primary/20 focus-visible:border-primary transition-all duration-200"
                />
              </div>
              {passwordForm.formState.errors.confirmPassword && (
                <span className="text-xs font-medium text-error ml-1">
                  {passwordForm.formState.errors.confirmPassword.message}
                </span>
              )}
              {passwordForm.formState.errors.newPassword && (
                <span className="block text-xs font-medium text-error ml-1">
                  {passwordForm.formState.errors.newPassword.message}
                </span>
              )}
            </div>

            {/* Error de confirmación mapeado por código (§3.30). */}
            {confirmErrorInfo && (
              <div className="p-3 bg-error-container text-on-error-container rounded-xl text-xs font-medium border border-error/20 space-y-2">
                <p>{confirmErrorInfo.message}</p>
                {confirmErrorInfo.needsNewCode && (
                  <button
                    type="button"
                    onClick={handleRequestNewCode}
                    className="font-semibold text-error hover:underline underline-offset-2"
                  >
                    Solicitar un código nuevo
                  </button>
                )}
              </div>
            )}

            <Button
              type="submit"
              disabled={confirmMutation.isPending}
              className="w-full h-12 sm:h-13 rounded-xl shadow-sm text-base font-semibold text-on-primary bg-primary hover:bg-on-primary-fixed-variant mt-2"
            >
              {confirmMutation.isPending ? 'Guardando…' : 'Cambiar contraseña e iniciar sesión'}
            </Button>
          </form>
        )}
      </CardContent>

      <CardFooter className="flex-col items-stretch px-8 sm:px-10 pb-4 sm:pb-5 pt-0 bg-transparent border-t-0 gap-0">
        <div className="mt-2 sm:mt-4 text-center">
          <Link
            to="/login"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:text-on-primary-fixed-variant transition-colors hover:underline underline-offset-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Volver a iniciar sesión
          </Link>
        </div>
      </CardFooter>
    </Card>
  );
}
