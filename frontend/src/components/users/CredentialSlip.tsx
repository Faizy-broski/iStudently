import { useTranslations } from 'next-intl'

interface CredentialSlipProps {
  schoolName: string
  fullName: string
  role: string
  username: string
  password: string
}

export function CredentialSlip({
  schoolName,
  fullName,
  role,
  username,
  password,
}: CredentialSlipProps) {
  const t = useTranslations('credentials')

  return (
    <div className="hidden print:block border rounded p-6 max-w-sm mx-auto text-sm space-y-3 font-sans">
      <h2 className="font-bold text-base">{schoolName}</h2>
      <p className="text-gray-700">
        {fullName} &mdash; <span className="capitalize">{role}</span>
      </p>
      <div className="border-t pt-3 space-y-2">
        <p>
          <strong>{t('username')}:</strong>{' '}
          <code className="font-mono bg-gray-100 px-1 rounded">{username}</code>
        </p>
        <p>
          <strong>{t('password')}:</strong>{' '}
          <code className="font-mono bg-gray-100 px-1 rounded">{password}</code>
        </p>
      </div>
      <p className="text-xs text-gray-500 pt-1">{t('credentialSlipNote')}</p>
    </div>
  )
}
