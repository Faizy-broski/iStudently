'use client'

import { useState, useEffect, FormEvent } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Eye, EyeOff, Loader2 } from 'lucide-react'

export default function LoginPage() {
  const searchParams = useSearchParams()
  const { signIn } = useAuth()
  
  // Animation States
  const [isExpanded, setIsExpanded] = useState(false)
  const [showContent, setShowContent] = useState(false)
  
  // Form States
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const error = searchParams.get('error')

  // Trigger Animations on Mount
  useEffect(() => {
    // 1. Expand the colored background
    const timer1 = setTimeout(() => setIsExpanded(true), 100)
    // 2. Show the form content
    const timer2 = setTimeout(() => setShowContent(true), 800)
    
    return () => {
      clearTimeout(timer1)
      clearTimeout(timer2)
    }
  }, [])

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)

    try {
      await signIn(email, password)
      toast.success('Welcome To iStudent.ly!')
      
      setTimeout(() => {
        window.location.href = '/'
      }, 500)
    } catch (error: unknown) {
      console.error('Login error:', error)
      const errorMessage = error instanceof Error ? error.message : 'Invalid email or password'
      toast.error(errorMessage)
      setLoading(false)
    }
  }

  // Helper for staggered fade-up animations
  const getAnimClass = (delay: string) => `
    transform transition-all duration-700 ease-out ${delay}
    ${showContent ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"}
  `

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-white overflow-hidden">
      
      {/* --- LEFT SIDE: Static Branding --- */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center items-center p-12 relative z-10">
        <div className={`text-center transition-all duration-1000 delay-300 ${
          showContent ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
        }`}>
          <h1 className="text-4xl lg:text-5xl font-bold text-brand-blue mb-4">
            iStudent.ly Login
          </h1>
          <p className="text-gray-500 text-lg mb-8">
            Manage your school with ease and efficiency.
          </p>
          
          <div className="relative w-64 h-64 mx-auto">
            <Image 
              src="/images/logo.svg" 
              alt="Studently Logo" 
              fill 
              className="object-contain"
              priority
            />
          </div>
        </div>
      </div>

      {/* --- RIGHT SIDE: Animated Login Form --- */}
      <div className="w-full lg:w-1/2 relative flex items-center justify-center min-h-[600px] lg:min-h-screen">
        
        {/* The Animated Bubble Background */}
        <div 
          className="absolute inset-0 gradient-blue shadow-2xl"
          style={{
            clipPath: isExpanded 
              ? "circle(150% at 100% 50%)"
              : "circle(0% at 100% 50%)",
            transition: "clip-path 1.2s cubic-bezier(0.77, 0, 0.175, 1)"
          }}
        />

        {/* Decorative Border Line */}
        <div 
          className="absolute inset-y-0 left-0 w-1 bg-white/20 hidden lg:block"
          style={{
            opacity: isExpanded ? 1 : 0,
            transition: "opacity 1s delay-500"
          }}
        />

        {/* Form Container */}
        <div className="relative z-20 w-full max-w-md px-8 py-12">
          
          <h2 className={`text-3xl font-bold text-white mb-8 text-center lg:text-left ${getAnimClass('delay-100')}`}>
            Login to Account
          </h2>

          <form onSubmit={handleSubmit} className="space-y-5">
            
            {/* Error Messages */}
            {error === 'account_inactive' && (
              <div className={`p-3 rounded-lg bg-red-500/20 border border-red-400/30 ${getAnimClass('delay-150')}`}>
                <p className="text-sm text-white">
                  Your account is inactive. Please contact your administrator.
                </p>
              </div>
            )}
            
            {error === 'unauthorized' && (
              <div className={`p-3 rounded-lg bg-red-500/20 border border-red-400/30 ${getAnimClass('delay-150')}`}>
                <p className="text-sm text-white">
                  You don&apos;t have permission to access that area.
                </p>
              </div>
            )}
            
            {error === 'role_not_supported' && (
              <div className={`p-3 rounded-lg bg-red-500/20 border border-red-400/30 ${getAnimClass('delay-150')}`}>
                <p className="text-sm text-white">
                  Your role is not yet supported in the system. Please contact support.
                </p>
              </div>
            )}
            
            {/* Email Input */}
            <div className={getAnimClass('delay-200')}>
              <Label className="text-white/90 mb-1.5 block">Email Address</Label>
              <Input
                type="email"
                placeholder="name@school.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-12 bg-white/10 border-white/20 text-white placeholder:text-white/50 focus:bg-white/20 focus:border-white transition-all"
                required
                disabled={loading}
                autoComplete="email"
              />
            </div>

            {/* Password Input */}
            <div className={getAnimClass('delay-300')}>
              <Label className="text-white/90 mb-1.5 block">Password</Label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-12 bg-white/10 border-white/20 text-white placeholder:text-white/50 focus:bg-white/20 focus:border-white transition-all pr-10"
                  required
                  disabled={loading}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/70 hover:text-white transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            {/* Forgot Password Link */}
            <div className={`flex justify-end ${getAnimClass('delay-400')}`}>
              <Link href="/forgot-password" className="text-sm text-white/80 hover:text-white hover:underline transition-colors">
                Forgot Password?
              </Link>
            </div>

            {/* Submit Button */}
            <div className={getAnimClass('delay-500')}>
              <Button 
                type="submit" 
                disabled={loading}
                className="w-full h-12 bg-white text-brand-blue hover:bg-white/90 font-bold text-lg shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all"
              >
                {loading ? <Loader2 className="animate-spin" /> : "Sign In"}
              </Button>
            </div>

            {/* Footer Text */}
            <p className={`text-center text-white/70 text-sm mt-6 ${getAnimClass('delay-600')}`}>
              Contact your administrator for account access
            </p>

          </form>
        </div>
      </div>
    </div>
  )
}
