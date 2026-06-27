export const metadata = { title: 'J Periodic Table' }

export default function TeacherJperiodPage() {
  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 64px)' }}>
      <iframe
        src="/zperiod/index.html"
        allow="fullscreen"
        className="w-full flex-1 border-none"
        title="J Periodic Table"
      />
    </div>
  )
}
