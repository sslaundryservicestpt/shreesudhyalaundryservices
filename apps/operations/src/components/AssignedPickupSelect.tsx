'use client';

import { useRouter } from 'next/navigation';

export default function AssignedPickupSelect({
  tasks,
}: {
  tasks: { id: string; label: string }[];
}) {
  const router = useRouter();
  return (
    <label>
      Assigned client site
      <select
        value=""
        onChange={(event) => {
          if (event.target.value) router.push('/workspace/pickups?task=' + event.target.value);
        }}
      >
        <option value="">Choose a pickup</option>
        {tasks.map((task) => (
          <option value={task.id} key={task.id}>
            {task.label}
          </option>
        ))}
      </select>
    </label>
  );
}
