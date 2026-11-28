import LabPlayer from '@/components/jahbadh-lab/LabPlayer'

export const metadata = { title: 'Jahbadh Lab' }

interface Props {
  params: Promise<{ code: string }>
}

export default async function TeacherJahbadhLabExperimentPage({ params }: Props) {
  const { code } = await params
  return <LabPlayer role="teacher" code={code} />
}
