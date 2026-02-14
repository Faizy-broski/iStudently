export default function EveningLeaveForm({ onSuccess }: any) {
  const submit = async (e: any) => {
    e.preventDefault();

    await fetch('/api/evening-leaves', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        student_id: 214,
        checkpoint_id: 1,
        start_date: '2026-02-10',
        end_date: '2026-02-20',
        days_of_week: [1, 3],
        authorized_return_time: '21:30'
      })
    });

    onSuccess();
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <button className="bg-black text-white px-4 py-2 rounded">
        Save Evening Leave
      </button>
    </form>
  );
}
