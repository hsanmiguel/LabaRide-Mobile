export type RiderProgressJob = {
  stage: string;
  status: string;
  order: { status: string; handoff?: { arrived: boolean; released: boolean } };
};

export function riderJobProgress(job: RiderProgressJob) {
  const complete = job.status === 'Completed';
  const stopped = !['Offered', 'Accepted', 'Completed'].includes(job.status);
  const detail = complete
    ? job.stage === 'Pickup' ? 'Pickup trip completed. The shop confirms receipt separately.' : 'Delivery trip completed. The customer confirms receipt separately.'
    : stopped ? 'This assignment has ended.'
    : job.status === 'Offered' ? 'Accept this job to take the trip.'
    : job.stage === 'Pickup' ? 'Collect from the customer and deliver to the shop. Confirm completed after shop handover.' : 'Collect from the shop and deliver to the customer. Confirm completed after customer handover.';
  return { steps: ['Accepted', 'Completed'], current: complete ? 1 : 0, detail, complete, stopped };
}
