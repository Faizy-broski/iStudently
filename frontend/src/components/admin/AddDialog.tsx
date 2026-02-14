import PackageForm from './forms/PackageForm';
import EntryExitForm from './forms/EntryExitForm';
import EveningLeaveForm from './forms/EveningLeaveForm';

export default function AddDialog({
  open,
  onClose,
  type,
  onSuccess
}: any) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center">
      <div className="bg-white p-6 rounded w-[400px] space-y-4">
        <h2 className="font-semibold text-lg">Add {type}</h2>

        {type === 'packages' && <PackageForm onSuccess={onSuccess} />}
        {type === 'entry-exit' && <EntryExitForm onSuccess={onSuccess} />}
        {type === 'evening-leaves' && <EveningLeaveForm onSuccess={onSuccess} />}

        <button onClick={onClose} className="text-sm text-gray-500">
          Close
        </button>
      </div>
    </div>
  );
}
