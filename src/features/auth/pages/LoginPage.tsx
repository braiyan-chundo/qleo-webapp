import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useLogin, useRegister } from '../hooks/use-auth';
import { LastAccountCard } from '../components/LastAccountCard';
import { clearLastAccount, getLastAccount } from '../lib/last-account';

import { Mail, Lock, EyeOff, Eye, User, Briefcase } from 'lucide-react';
import { QleoLogo } from '@/shared/components/QleoLogo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';

/**
 * Flags de UI del login (QL-38). El cliente pidió ocultar el registro y el acceso con
 * Google, pero el código debe quedar reactivable. Poner ambos en `true` restaura el
 * switch de pestañas (Iniciar sesión / Registrarse) y el botón social sin más cambios.
 */
const AUTH_FEATURES = {
  register: false,
  googleSignIn: false,
} as const;

const loginSchema = z.object({
  email: z.string().email('Correo electrónico inválido'),
  password: z.string().min(1, 'La contraseña es requerida'),
});

const registerSchema = z.object({
  name: z.string().min(2, 'El nombre es requerido'),
  email: z.string().email('Correo electrónico inválido'),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
  jobTitle: z.string().optional(),
});

export const LoginPage = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');
  // QL-44: última cuenta recordada (localStorage). Se lee una vez al montar.
  const [rememberedAccount, setRememberedAccount] = useState(() => getLastAccount());

  const loginMutation = useLogin();
  const registerMutation = useRegister();

  const isLoading = loginMutation.isPending || registerMutation.isPending;
  const activeError =
    activeTab === 'login' ? loginMutation.error : registerMutation.error;
  const error = activeError instanceof Error ? activeError.message : '';

  const loginForm = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const registerForm = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: '', email: '', password: '', jobTitle: '' },
  });

  const onLogin = (data: z.infer<typeof loginSchema>) => {
    loginMutation.mutate(data);
  };

  // QL-44: al elegir la cuenta recordada, precarga el email y enfoca la contraseña.
  const handleSelectRememberedAccount = () => {
    if (!rememberedAccount) return;
    loginForm.setValue('email', rememberedAccount.email);
    loginForm.setFocus('password');
  };

  // "Usar otra cuenta": olvida la cuenta recordada y muestra el formulario limpio.
  const handleUseAnotherAccount = () => {
    clearLastAccount();
    setRememberedAccount(null);
    loginForm.setValue('email', '');
    loginForm.setFocus('email');
  };

  const onRegister = (data: z.infer<typeof registerSchema>) => {
    registerMutation.mutate(data);
  };

  return (
    <Card className="rounded-[24px] shadow-[0_8px_40px_-12px_rgba(0,0,0,0.1)] border border-outline-variant/30 ring-0 w-full animate-in fade-in zoom-in-95 duration-500 p-0 overflow-visible">

      <CardHeader className="text-center pt-8 sm:pt-10 px-8 sm:px-10 pb-0 gap-3">
        <CardTitle className="flex justify-center">
          <QleoLogo
            size={44}
            className="gap-3 text-primary dark:text-inverse-primary dark:glow-text"
            textClassName="text-4xl font-extrabold tracking-tight"
          />
        </CardTitle>
        <CardDescription className="text-sm text-on-surface-variant font-medium">
          Organiza el trabajo de tu equipo, sin complicaciones.
        </CardDescription>
      </CardHeader>

      <CardContent className="px-8 sm:px-10 py-8">
        {/* Segmented Control / Tabs (QL-38: oculto mientras el registro esté desactivado;
            sin él, el login ocupa el card sin dejar el switch vacío). */}
        {AUTH_FEATURES.register && (
          <div className="flex bg-surface-container-low p-1 rounded-xl mb-8 relative">
            <div
              className={`absolute inset-y-1 w-[calc(50%-4px)] bg-surface-container-lowest rounded-lg shadow-sm border border-outline-variant/20 transition-transform duration-300 ${activeTab === 'register' ? 'translate-x-full left-1' : 'left-1'}`}
            />
            <button
              type="button"
              onClick={() => setActiveTab('login')}
              className={`flex-1 py-2 relative z-10 text-xs font-medium text-center focus:outline-none transition-colors ${activeTab === 'login' ? 'text-on-surface' : 'text-on-surface-variant hover:text-on-surface'}`}
            >
              Iniciar Sesión
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('register')}
              className={`flex-1 py-2 relative z-10 text-xs font-medium text-center focus:outline-none transition-colors ${activeTab === 'register' ? 'text-on-surface' : 'text-on-surface-variant hover:text-on-surface'}`}
            >
              Registrarse
            </button>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-error-container text-on-error-container rounded-xl text-sm font-medium flex items-center gap-2 border border-error/20">
            <div className="w-1.5 h-1.5 rounded-full bg-error" />
            {error}
          </div>
        )}

        {/* Form Section */}
        {!AUTH_FEATURES.register || activeTab === 'login' ? (
          <form onSubmit={loginForm.handleSubmit(onLogin)} className="space-y-5">
            {/* Última cuenta recordada (QL-44): tarjeta "¿Esta es tu cuenta?" + "Usar otra cuenta". */}
            {rememberedAccount && (
              <div className="space-y-2.5">
                <p className="ml-1 text-xs font-medium text-on-surface-variant">
                  ¿Esta es tu cuenta?
                </p>
                <LastAccountCard
                  account={rememberedAccount}
                  onSelect={handleSelectRememberedAccount}
                />
                <div className="text-center">
                  <button
                    type="button"
                    onClick={handleUseAnotherAccount}
                    className="text-xs font-medium text-primary transition-colors hover:underline underline-offset-2"
                  >
                    Usar otra cuenta
                  </button>
                </div>
              </div>
            )}

            {/* Email Input */}
            <div className="space-y-1.5">
              <Label className="block text-xs font-medium text-on-surface ml-1" htmlFor="email">Correo electrónico</Label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="w-5 h-5 text-outline" />
                </div>
                <Input
                  id="email"
                  type="email"
                  placeholder="ejemplo@agencia.com"
                  {...loginForm.register('email')}
                  className="w-full h-12 pl-10 pr-4 bg-surface-bright border-outline-variant/60 rounded-xl text-sm text-on-surface placeholder:text-outline-variant/80 focus-visible:ring-primary/20 focus-visible:border-primary transition-all duration-200"
                />
              </div>
              {loginForm.formState.errors.email && (
                <span className="text-xs font-medium text-error ml-1">{loginForm.formState.errors.email.message}</span>
              )}
            </div>

            {/* Password Input */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between ml-1 mb-1.5">
                <Label className="block text-xs font-medium text-on-surface" htmlFor="password">Contraseña</Label>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="w-5 h-5 text-outline" />
                </div>
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  {...loginForm.register('password')}
                  className="w-full h-12 pl-10 pr-10 bg-surface-bright border-outline-variant/60 rounded-xl text-sm text-on-surface placeholder:text-outline-variant/80 focus-visible:ring-primary/20 focus-visible:border-primary transition-all duration-200"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-outline hover:text-on-surface transition-colors focus:outline-none"
                >
                  {showPassword ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
                </button>
              </div>
              {loginForm.formState.errors.password && (
                <span className="text-xs font-medium text-error ml-1">{loginForm.formState.errors.password.message}</span>
              )}
            </div>

            {/* Forgot Password Link */}
            <div className="flex items-center justify-end">
              <a href="#" className="text-xs font-medium text-primary hover:text-on-primary-fixed-variant transition-colors hover:underline underline-offset-2">
                ¿Olvidaste tu contraseña?
              </a>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-14 rounded-xl shadow-sm text-base font-semibold text-on-primary bg-primary hover:bg-on-primary-fixed-variant mt-2"
            >
              {isLoading ? 'Iniciando...' : 'Entrar a la plataforma'}
            </Button>
          </form>
        ) : (
          <form onSubmit={registerForm.handleSubmit(onRegister)} className="space-y-5">
            {/* Name Input */}
            <div className="space-y-1.5">
              <Label className="block text-xs font-medium text-on-surface ml-1" htmlFor="name">Nombre completo</Label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="w-5 h-5 text-outline" />
                </div>
                <Input
                  id="name"
                  type="text"
                  placeholder="Tu nombre"
                  {...registerForm.register('name')}
                  className="w-full h-12 pl-10 pr-4 bg-surface-bright border-outline-variant/60 rounded-xl text-sm text-on-surface placeholder:text-outline-variant/80 focus-visible:ring-primary/20 focus-visible:border-primary transition-all duration-200"
                />
              </div>
              {registerForm.formState.errors.name && (
                <span className="text-xs font-medium text-error ml-1">{registerForm.formState.errors.name.message}</span>
              )}
            </div>

            {/* Email Input */}
            <div className="space-y-1.5">
              <Label className="block text-xs font-medium text-on-surface ml-1" htmlFor="register-email">Correo electrónico</Label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="w-5 h-5 text-outline" />
                </div>
                <Input
                  id="register-email"
                  type="email"
                  placeholder="ejemplo@agencia.com"
                  {...registerForm.register('email')}
                  className="w-full h-12 pl-10 pr-4 bg-surface-bright border-outline-variant/60 rounded-xl text-sm text-on-surface placeholder:text-outline-variant/80 focus-visible:ring-primary/20 focus-visible:border-primary transition-all duration-200"
                />
              </div>
              {registerForm.formState.errors.email && (
                <span className="text-xs font-medium text-error ml-1">{registerForm.formState.errors.email.message}</span>
              )}
            </div>

            {/* Job Title Input */}
            <div className="space-y-1.5">
              <Label className="block text-xs font-medium text-on-surface ml-1" htmlFor="jobTitle">Cargo (opcional)</Label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Briefcase className="w-5 h-5 text-outline" />
                </div>
                <Input
                  id="jobTitle"
                  type="text"
                  placeholder="Diseñador de itinerarios"
                  {...registerForm.register('jobTitle')}
                  className="w-full h-12 pl-10 pr-4 bg-surface-bright border-outline-variant/60 rounded-xl text-sm text-on-surface placeholder:text-outline-variant/80 focus-visible:ring-primary/20 focus-visible:border-primary transition-all duration-200"
                />
              </div>
              {registerForm.formState.errors.jobTitle && (
                <span className="text-xs font-medium text-error ml-1">{registerForm.formState.errors.jobTitle.message}</span>
              )}
            </div>

            {/* Password Input */}
            <div className="space-y-1.5">
              <Label className="block text-xs font-medium text-on-surface ml-1" htmlFor="register-password">Contraseña</Label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="w-5 h-5 text-outline" />
                </div>
                <Input
                  id="register-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  {...registerForm.register('password')}
                  className="w-full h-12 pl-10 pr-10 bg-surface-bright border-outline-variant/60 rounded-xl text-sm text-on-surface placeholder:text-outline-variant/80 focus-visible:ring-primary/20 focus-visible:border-primary transition-all duration-200"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-outline hover:text-on-surface transition-colors focus:outline-none"
                >
                  {showPassword ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
                </button>
              </div>
              {registerForm.formState.errors.password && (
                <span className="text-xs font-medium text-error ml-1">{registerForm.formState.errors.password.message}</span>
              )}
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-14 rounded-xl shadow-sm text-base font-semibold text-on-primary bg-primary hover:bg-on-primary-fixed-variant mt-2"
            >
              {isLoading ? 'Registrando...' : 'Crear cuenta'}
            </Button>
          </form>
        )}
      </CardContent>

      <CardFooter className="flex-col items-stretch px-8 sm:px-10 pb-8 sm:pb-10 pt-0 bg-transparent border-t-0 gap-0">
        {/* Acceso con Google (QL-38: oculto por defecto, reactivable con el flag). */}
        {AUTH_FEATURES.googleSignIn && (
          <>
            {/* Divider */}
            <div className="mb-6 mt-0">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-outline-variant/40" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-4 bg-surface-container-lowest text-xs font-medium text-outline">o continuar con</span>
                </div>
              </div>
            </div>

            {/* Social Login */}
            <div>
              <Button variant="outline" type="button" className="w-full h-14 bg-surface-container-lowest border-outline-variant/60 rounded-xl text-base font-semibold text-on-surface hover:bg-surface-container-low transition-all duration-200">
                <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                Google
              </Button>
            </div>
          </>
        )}

        {/* Footer / Privacy */}
        <div className="mt-8 text-center">
          <p className="text-xs font-medium text-outline">
            Al continuar, aceptas nuestros <a href="#" className="text-primary hover:underline underline-offset-2">Términos de servicio</a> y <a href="#" className="text-primary hover:underline underline-offset-2">Política de privacidad</a>.
          </p>
        </div>
      </CardFooter>
    </Card>
  );
};
