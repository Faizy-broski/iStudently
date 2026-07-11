export const metadata = { title: 'J Periodic Table' }

export default function StudentJperiodPage() {
  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 64px)' }}>
      <iframe
        src="/jperiod/index.html"
        allow="fullscreen"
        className="w-full flex-1 border-none"
        title="J Periodic Table Interactive Periodic Table"
      />
    </div>
  )
}
