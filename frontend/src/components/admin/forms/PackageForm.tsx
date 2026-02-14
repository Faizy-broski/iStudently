export default function PackageForm({ onSuccess }: any) {
  const submit = async (e: any) => {
    e.preventDefault();

    await fetch('/api/packages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        student_id: 214,
        description: e.target.description.value
      })
    });

    onSuccess();
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <input
        name="description"
        placeholder="Package description"
        className="w-full border px-3 py-2"
      />
      <button className="bg-black text-white px-4 py-2 rounded">
        Save
      </button>
    </form>
  );
}
