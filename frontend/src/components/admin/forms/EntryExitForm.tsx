export default function EntryExitForm({ onSuccess }: any) {
  const submit = async (e: any) => {
    e.preventDefault();

    await fetch('/api/entries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        checkpoint_id: 1,
        person_type: 'student',
        person_id: 214,
        direction: e.target.direction.value
      })
    });

    onSuccess();
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <select name="direction" className="w-full border px-3 py-2">
        <option value="in">Entry</option>
        <option value="out">Exit</option>
      </select>

      <button className="bg-black text-white px-4 py-2 rounded">
        Record
      </button>
    </form>
  );
}
