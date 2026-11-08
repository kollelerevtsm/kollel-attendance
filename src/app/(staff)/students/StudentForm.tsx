export interface StudentRow {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  email: string | null;
  address: string | null;
  father_name: string | null;
  father_in_law_name: string | null;
  pin: string;
  test_pin: string | null;
  active: boolean;
  start_date: string;
  fingerprint_enrolled: boolean;
}

function Field({ name, label, defaultValue, required, type = "text", dir }: {
  name: string; label: string; defaultValue?: string | null; required?: boolean; type?: string; dir?: "auto";
}) {
  return (
    <div>
      <label className="label" htmlFor={name}>{label}{required && " *"}</label>
      <input className="input" id={name} name={name} type={type} defaultValue={defaultValue ?? ""} required={required} dir={dir} autoComplete="off" />
    </div>
  );
}

export function StudentForm({ student, action, canEdit }: {
  student?: StudentRow;
  action: (fd: FormData) => Promise<void>;
  canEdit: boolean;
}) {
  return (
    <form action={action} autoComplete="off" className="card space-y-5">
      {student && <input type="hidden" name="id" value={student.id} />}
      <fieldset disabled={!canEdit} className="grid gap-4 md:grid-cols-2">
        <Field name="first_name" label="First name" defaultValue={student?.first_name} required dir="auto" />
        <Field name="last_name" label="Last name" defaultValue={student?.last_name} required dir="auto" />
        <Field name="phone" label="Phone" type="tel" defaultValue={student?.phone} required />
        <Field name="email" label="Email (used to sign in)" type="email" defaultValue={student?.email} />
        <div className="md:col-span-2">
          <Field name="address" label="Address" defaultValue={student?.address} dir="auto" />
        </div>
        <Field name="father_name" label="Father's name" defaultValue={student?.father_name} dir="auto" />
        <Field name="father_in_law_name" label="Father-in-law's name" defaultValue={student?.father_in_law_name} dir="auto" />
        <Field name="start_date" label="Start date" type="date" defaultValue={student?.start_date} />
        {student ? (
          <div>
            <label className="label" htmlFor="pin">PIN / scanner user ID</label>
            <input className="input font-mono" id="pin" name="pin" defaultValue={student.pin} required pattern="[0-9]{4,10}" />
            <p className="mt-1 text-xs text-gray-500">If you change this, re-enroll the fingerprint on the scanner under the new number.</p>
          </div>
        ) : null}
        {student ? (
          <div>
            <label className="label" htmlFor="test_pin">Test ID (scanner ID for the test finger)</label>
            <input className="input font-mono" id="test_pin" name="test_pin" defaultValue={student.test_pin ?? `9${student.pin}`} required pattern="[0-9]{4,12}" />
            <p className="mt-1 text-xs text-gray-500">Enroll a different finger on the scanner under this number. Scanning it on a test night marks him as having taken the test.</p>
          </div>
        ) : (
          <div className="flex items-end text-sm text-gray-500">
            The PIN is set automatically from the last 4 digits of the phone.
          </div>
        )}
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="fingerprint_enrolled" defaultChecked={student?.fingerprint_enrolled} />
          Fingerprint enrolled on the scanner
        </label>
        {student && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="active" defaultChecked={student.active} />
            Active student
          </label>
        )}
      </fieldset>
      {canEdit && <button className="btn" type="submit">{student ? "Save changes" : "Add student"}</button>}
    </form>
  );
}
