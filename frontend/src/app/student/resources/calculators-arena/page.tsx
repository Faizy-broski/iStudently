export const metadata = { title: 'Calculators Arena' }

export default function StudentCalculatorsArenaPage() {
  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 64px)' }}>
      <iframe
        src="/tuxmath/index.html"
        allow="autoplay; fullscreen"
        className="w-full flex-1 border-none"
        title="Calculators Arena - TuxMath"
      />
    </div>
  )
}
