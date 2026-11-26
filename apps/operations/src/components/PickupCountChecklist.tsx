export type CountChecklistItem = { id: string; label: string; count: string };

export default function PickupCountChecklist({
  items,
  legend = 'Confirm every count',
}: {
  items: CountChecklistItem[];
  legend?: string;
}) {
  return (
    <fieldset className="pickup-count-checklist">
      <legend>{legend}</legend>
      {items.map((item) => (
        <label key={item.id}>
          <input name="confirmed" value={item.id} type="checkbox" required />
          <span>{item.label}</span>
          <strong>{item.count}</strong>
        </label>
      ))}
    </fieldset>
  );
}
