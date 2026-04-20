import { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
} from 'react-native'
import { useForm, Controller } from 'react-hook-form'
import { z } from 'zod'
import { SafeAreaView } from 'react-native-safe-area-context'
import { C } from '@/lib/colors'
import { api } from '@/lib/api'
import { useAuthStore } from '@/store/auth.store'

// Zod schema — used for manual parse validation inside onSubmit
const loginSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

type LoginForm = { email: string; password: string }

export default function LoginScreen() {
  const setAuth = useAuthStore((s) => s.setAuth)
  const [serverError, setServerError] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const {
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    defaultValues: { email: '', password: '' },
  })

  const onSubmit = async (values: LoginForm) => {
    setServerError('')

    // Validate with zod before hitting the API
    const parsed = loginSchema.safeParse(values)
    if (!parsed.success) {
      parsed.error.errors.forEach((e) => {
        const field = e.path[0] as keyof LoginForm
        setError(field, { message: e.message })
      })
      return
    }

    try {
      const { data } = await api.post('/auth/login', {
        email: values.email,
        password: values.password,
      })
      // Persist refresh token + user so the session survives app close/reopen.
      // Access token is re-derived silently via /auth/refresh on boot.
      setAuth(data.accessToken, data.refreshToken ?? '', data.user)
    } catch (err: any) {
      console.log('[LOGIN ERROR]', {
        url: err?.config?.baseURL,
        path: err?.config?.url,
        status: err?.response?.status,
        data: err?.response?.data,
        message: err?.message,
        code: err?.code,
      })
      const serverMsg = err?.response?.data?.message
      const networkMsg = !err?.response ? `Network error: ${err?.message ?? 'no response'}` : null
      const msg = serverMsg ?? networkMsg ?? 'Invalid email or password. Please try again.'
      setServerError(msg)
    }
  }

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView
        style={s.kav}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Brand header ── */}
          <View style={s.brand}>
            <View style={s.logoCircle}>
              <Text style={s.logoText}>LMS</Text>
            </View>
            <Text style={s.appName}>LMS CRM</Text>
            <Text style={s.tagline}>Sales Intelligence Platform</Text>
          </View>

          {/* ── Card ── */}
          <View style={s.card}>
            <Text style={s.cardTitle}>Sign in to your account</Text>

            {/* Server error banner */}
            {serverError.length > 0 && (
              <View style={s.errorBanner}>
                <Text style={s.errorBannerText}>{serverError}</Text>
              </View>
            )}

            {/* Email */}
            <View style={s.fieldGroup}>
              <Text style={s.label}>Email address</Text>
              <Controller
                control={control}
                name="email"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    style={[s.input, errors.email && s.inputError]}
                    placeholder="admin@lms.com"
                    placeholderTextColor={C.textMuted}
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="email"
                    returnKeyType="next"
                    textContentType="emailAddress"
                  />
                )}
              />
              {errors.email && (
                <Text style={s.fieldError}>{errors.email.message}</Text>
              )}
            </View>

            {/* Password */}
            <View style={s.fieldGroup}>
              <Text style={s.label}>Password</Text>
              <View style={s.passwordRow}>
                <Controller
                  control={control}
                  name="password"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <TextInput
                      style={[s.input, s.passwordInput, errors.password && s.inputError]}
                      placeholder="••••••••"
                      placeholderTextColor={C.textMuted}
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                      autoCorrect={false}
                      autoComplete="password"
                      returnKeyType="done"
                      textContentType="password"
                      onSubmitEditing={handleSubmit(onSubmit)}
                    />
                  )}
                />
                <Pressable
                  style={s.eyeBtn}
                  onPress={() => setShowPassword((v) => !v)}
                  hitSlop={8}
                >
                  <Text style={s.eyeText}>{showPassword ? 'Hide' : 'Show'}</Text>
                </Pressable>
              </View>
              {errors.password && (
                <Text style={s.fieldError}>{errors.password.message}</Text>
              )}
            </View>

            {/* Submit */}
            <Pressable
              style={({ pressed }) => [
                s.submitBtn,
                pressed && s.submitBtnPressed,
                isSubmitting && s.submitBtnDisabled,
              ]}
              onPress={handleSubmit(onSubmit)}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={s.submitText}>Sign In</Text>
              )}
            </Pressable>
          </View>

          {/* ── Demo hint ── */}
          <View style={s.hintBox}>
            <Text style={s.hintLabel}>Demo credentials</Text>
            <Text style={s.hintCred}>admin@lms.com  /  admin123</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: C.primary,
  },
  kav: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32,
  },

  // Brand
  brand: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  logoText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 1,
  },
  appName: {
    fontSize: 32,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  tagline: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.75)',
    letterSpacing: 0.3,
  },

  // Card
  card: {
    backgroundColor: C.surface,
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: C.text,
    marginBottom: 20,
    textAlign: 'center',
  },

  // Error banner
  errorBanner: {
    backgroundColor: C.errorLight,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#fca5a5',
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 16,
  },
  errorBannerText: {
    color: C.errorText,
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },

  // Fields
  fieldGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: C.text,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: C.text,
    backgroundColor: C.surface,
  },
  inputError: {
    borderColor: C.error,
  },
  fieldError: {
    color: C.error,
    fontSize: 12,
    marginTop: 4,
    fontWeight: '500',
  },
  passwordRow: {
    position: 'relative',
  },
  passwordInput: {
    paddingRight: 60,
  },
  eyeBtn: {
    position: 'absolute',
    right: 14,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  eyeText: {
    fontSize: 13,
    fontWeight: '600',
    color: C.primary,
  },

  // Submit
  submitBtn: {
    backgroundColor: C.primary,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  submitBtnPressed: {
    backgroundColor: C.primaryDark,
  },
  submitBtnDisabled: {
    opacity: 0.7,
  },
  submitText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  // Hint
  hintBox: {
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  hintLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.65)',
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  hintCred: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '600',
    letterSpacing: 0.2,
  },
})
