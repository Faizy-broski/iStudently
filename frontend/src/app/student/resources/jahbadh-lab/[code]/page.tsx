import LabPlayer from '@/components/jahbadh-lab/LabPlayer'

export const metadata = { title: 'Jahbadh Lab' }

interface Props {
  params: Promise<{ code: string }>
}

export default async function StudentJahbadhLabExperimentPage({ params }: Props) {
  const { code } = await params
  return <LabPlayer role="student" code={code} />
}
