type Audience = 'customer' | 'partner' | 'rider' | 'admin';
type Copy = [title: string, message: string];
type Copies = Record<Audience, Copy>;
const roles: Audience[] = ['customer', 'partner', 'rider', 'admin'];
const copies = (customer: Copy, partner: Copy, rider: Copy, admin: Copy): Copies => ({ customer, partner, rider, admin });

// Internal assignment markers belong in event history, never in public messages.
export function cleanNotificationText(text: string) {
  return text.replace(/Assignment\s*#\s*\d+\s*[·—-]?\s*(?:(?:pickup|collection|delivery)\s+handover)?\.?/gi, '').replace(/\s+/g, ' ').replace(/[ ·]+$/g, '').trim();
}

const statuses: Record<string, Copies> = {
  BookingPending: copies(['Booking submitted', 'Your booking is waiting for shop confirmation.'], ['New laundry order', 'Review the booking and accept or decline it.'], ['Booking awaiting approval', 'The shop has not confirmed this booking yet.'], ['New booking', 'A customer submitted a laundry booking.']),
  PickupQueued: copies(['Booking accepted', 'The shop is arranging your laundry pickup.'], ['Pickup awaiting rider', 'The booking is accepted and waiting for a pickup rider.'], ['Pickup available', 'A customer pickup is ready to claim.'], ['Pickup queued', 'The booking is waiting for a pickup rider.']),
  PickupAssigned: copies(['Pickup rider assigned', 'A rider has been assigned to collect your laundry.'], ['Pickup rider assigned', 'A rider was assigned to the customer pickup.'], ['New pickup assignment', 'Accept the pickup job to continue.'], ['Pickup assigned', 'A rider was offered the pickup job.']),
  PickupAccepted: copies(['Pickup rider confirmed', 'Your rider will collect your laundry.'], ['Customer pickup confirmed', 'The rider will collect the customer’s laundry.'], ['Pickup job accepted', 'Proceed to the customer?s collection address. Open the trip details for navigation and handover confirmation.'], ['Pickup accepted', 'A rider accepted the pickup job.']),
  PickupEnRoute: copies(['Rider is on the way', 'Your rider is heading to your pickup address.'], ['Rider heading to customer', 'The rider is on the way to collect the laundry.'], ['Pickup trip started', 'Mark arrival when you reach the customer.'], ['Pickup trip started', 'The rider is heading to the pickup address.']),
  LaundryPickedUp: copies(['Laundry picked up', 'Your laundry is on its way to the shop.'], ['Laundry heading to shop', 'The rider collected the customer’s laundry.'], ['Pickup confirmed', 'Take the laundry to the shop.'], ['Customer pickup complete', 'The rider is taking the laundry to the shop.']),
  AtPartner: copies(['Laundry reached the shop', 'The shop will confirm receipt of your laundry.'], ['Laundry has arrived', 'Confirm receipt after checking the laundry.'], ['Shop drop-off recorded', 'The shop will confirm receipt of the laundry.'], ['Laundry at shop', 'The laundry is awaiting shop receipt.']),
  LaundryReceived: copies(['Shop received your laundry', 'Your laundry is queued for washing.'], ['Laundry added to queue', 'Start washing when the laundry is ready to process.'], ['Shop receipt confirmed', 'The shop has received the laundry you delivered.'], ['Laundry received', 'The shop confirmed receipt of the laundry.']),
  Washing: copies(['Your laundry is being washed', 'The shop has started washing your laundry.'], ['Washing started', 'Move the laundry to drying when washing is finished.'], ['Laundry is being washed', 'The shop is washing this order.'], ['Washing in progress', 'The shop started the washing stage.']),
  Drying: copies(['Your laundry is being dried', 'Washing is finished and your laundry is now drying.'], ['Drying started', 'Fold the laundry when drying is finished.'], ['Laundry is being dried', 'The shop is drying this order.'], ['Drying in progress', 'The shop started the drying stage.']),
  Folding: copies(['Your laundry is being folded', 'The shop is preparing your clean laundry.'], ['Folding started', 'Mark the laundry ready once folding is finished.'], ['Laundry is being folded', 'The shop is preparing this order for return.'], ['Folding in progress', 'The shop started the folding stage.']),
  ReadyForDelivery: copies(['Laundry ready for delivery', 'Your clean laundry is waiting for a rider at the shop.'], ['Awaiting delivery rider', 'Your clean laundry is ready for rider collection.'], ['Delivery job available', 'Clean laundry is ready to collect from the shop.'], ['Laundry ready for delivery', 'The order is waiting for a delivery rider.']),
  ReadyForCollection: copies(['Ready for collection', 'You can collect your clean laundry from the shop.'], ['Awaiting customer collection', 'Hand over the clean laundry when the customer arrives.'], ['Customer collection selected', 'This order will be collected directly from the shop.'], ['Ready for customer collection', 'The customer can collect the laundry at the shop.']),
  DeliveryAssigned: copies(['Delivery rider assigned', 'A rider has been assigned to collect your clean laundry.'], ['Delivery rider assigned', 'A rider was offered collection from your shop.'], ['New delivery assignment', 'Accept the delivery job to continue.'], ['Delivery assigned', 'A rider was offered the delivery job.']),
  DeliveryAccepted: copies(['Rider heading to laundry shop', 'Your rider is on the way to collect your clean laundry.'], ['Rider is on the way to the shop', 'The rider will collect the clean laundry for the customer.'], ['Delivery job accepted', 'Proceed to the laundry shop for collection. Open the trip details for navigation and handover confirmation.'], ['Delivery rider confirmed', 'A rider accepted collection from the shop.']),
  CleanLaundryCollected: copies(['Rider collected your laundry', 'Your clean laundry has been picked up from the shop.'], ['Rider collected the laundry', 'The rider has your clean laundry for customer delivery.'], ['Shop collection confirmed', 'Start the delivery trip to the customer.'], ['Clean laundry collected', 'The rider confirmed collection from the shop.']),
  OutForDelivery: copies(['Your laundry is on the way', 'Your rider is bringing your clean laundry to you.'], ['Laundry out for delivery', 'The rider is delivering the laundry to the customer.'], ['Delivery trip started', 'Mark arrival when you reach the customer.'], ['Delivery in progress', 'The rider is heading to the customer.']),
  Delivered: copies(['Your laundry has arrived', 'Confirm receipt after receiving your clean laundry.'], ['Laundry delivered', 'The rider delivered the laundry to the customer.'], ['Delivery recorded', 'Complete the customer handover to finish the job.'], ['Delivery recorded', 'The laundry is awaiting customer confirmation.']),
  Completed: copies(['Order complete', 'Your clean laundry has been received. Thank you!'], ['Order completed', 'The customer has received their clean laundry.'], ['Delivery complete', 'The customer handover is complete. Your job is finished.'], ['Order fulfilled', 'The laundry order has been completed.']),
  Cancelled: copies(['Booking cancelled', 'Your laundry booking has been cancelled.'], ['Order cancelled', 'This order is closed. Do not process or release it.'], ['Job cancelled', 'Stop this job and check your dashboard for other jobs.'], ['Order cancelled', 'The booking was cancelled.']),
};
statuses.Accepted = copies(['Booking accepted', 'The shop has accepted your laundry booking.'], ['Order accepted', 'Confirm receipt when the laundry reaches your shop.'], ['Booking confirmed', 'The shop accepted this laundry order.'], ['Order accepted', 'The shop confirmed the booking.']);
statuses.Queued = statuses.LaundryReceived;
statuses.Processing = copies(['Your laundry is being processed', 'The shop has started processing your laundry.'], ['Processing started', 'Update the order as each laundry stage is finished.'], ['Order being processed', 'The shop is processing this laundry order.'], ['Processing in progress', 'The shop started processing the order.']);
statuses.Ready = copies(['Your laundry is ready', 'Check your order for delivery or collection details.'], ['Laundry ready for return', 'Arrange rider pickup or customer collection.'], ['Laundry ready', 'Check whether this order is available for delivery.'], ['Order ready for return', 'The shop marked the laundry ready.']);

export function orderNotificationCopy(input: { audience: string; orderId: number; action: string; status: string; detail?: string | null }) {
  const role: Audience = roles.includes(input.audience as Audience) ? input.audience as Audience : 'customer';
  const { action, status } = input;
  const kind = /collection handover/i.test(input.detail || '') || status === 'DeliveryAccepted' ? 'collection' : /delivery handover/i.test(input.detail || '') || status === 'OutForDelivery' ? 'delivery' : 'pickup';
  let options = statuses[status];
  if (action === 'TripCompleted') options = status === 'AtPartner'
    ? copies(['Rider delivered laundry to shop', 'Your rider reported delivery to the shop. Shop receipt is awaiting confirmation.'], ['Confirm laundry receipt', 'The rider reported handing over the laundry. Check it and confirm receipt.'], ['Pickup trip completed', 'Your trip is complete. The shop will separately confirm receipt.'], ['Pickup trip completed', 'The rider reported shop handover. Shop receipt is pending.'])
    : copies(['Confirm your laundry receipt', 'Your rider reported delivery. Confirm receipt after receiving your clean laundry.'], ['Rider completed return delivery', 'The rider reported customer handover. Customer receipt is pending.'], ['Delivery trip completed', 'Your trip is complete. The customer will separately confirm receipt.'], ['Delivery trip completed', 'The rider reported customer handover. Customer receipt is pending.']);
  if (action === 'HandoffArrived') options = kind === 'collection'
    ? copies(['Rider arrived at laundry shop', 'Your rider is at the shop to collect your clean laundry.'], ['Rider arrived at the shop', 'Hand over the clean laundry and confirm the handover.'], ['Shop arrival recorded', 'Ask the shop to confirm the laundry handover.'], ['Rider reached laundry shop', 'The rider is waiting for the shop handover.'])
    : kind === 'delivery'
      ? copies(['Your rider has arrived', 'Receive your clean laundry and confirm the handover.'], ['Rider reached the customer', 'The rider is handing over the clean laundry.'], ['Customer arrival recorded', 'Ask the customer to confirm receipt.'], ['Rider reached delivery address', 'The rider is waiting for customer handover.'])
      : copies(['Your pickup rider has arrived', 'Hand your laundry to the rider and confirm the handover.'], ['Rider reached pickup address', 'The rider is collecting the customer’s laundry.'], ['Pickup arrival recorded', 'Ask the customer to confirm the laundry handover.'], ['Rider reached pickup address', 'The rider is waiting for customer handover.']);
  if (action === 'HandoffReleased') options = kind === 'collection'
    ? copies(['Laundry handed to rider', 'Your clean laundry is being collected for delivery.'], ['Shop handover confirmed', 'The rider will confirm collection of the laundry.'], ['Shop confirmed handover', 'Check the laundry, then confirm collection.'], ['Shop released laundry', 'Waiting for the rider to confirm collection.'])
    : kind === 'delivery'
      ? copies(['Receipt confirmed', 'Your rider will finish the delivery.'], ['Customer confirmed receipt', 'The rider is completing the delivery.'], ['Customer confirmed receipt', 'Confirm delivery to finish your job.'], ['Customer handover confirmed', 'Waiting for the rider to complete delivery.'])
      : copies(['Laundry handed over', 'Your rider will confirm collection.'], ['Customer handed over laundry', 'The rider is confirming the customer pickup.'], ['Customer confirmed handover', 'Check the laundry, then confirm collection.'], ['Customer released laundry', 'Waiting for the rider to confirm pickup.']);
  if (action === 'WeightAndPriceUpdated') options = copies(['Laundry weight updated', 'Check your measured weight, price and scale photo.'], ['Weight and price saved', 'The customer can view the updated weight and scale photo.'], ['Laundry weight updated', 'Check the order details for the latest weight.'], ['Order measurement updated', 'Measured weight and price were updated.']);
  if (action === 'ReadyEstimateUpdated') options = copies(['Ready time updated', 'Check your order for the latest estimated ready time.'], ['Ready estimate saved', 'The customer can see the revised ready time.'], ['Ready time changed', 'Check the order for the latest ready estimate.'], ['Ready estimate updated', 'The shop revised the ready estimate.']);
  if (action === 'IssueReported') options = copies(['Order issue reported', 'Check your order for the issue details.'], ['Order needs attention', 'Review the reported issue in order details.'], ['Issue reported', 'Check the job details for the next step.'], ['Order issue reported', 'Review the issue in operations.']);
  if (action === 'resolveIssue' || action === 'IssueResolved') options = copies(['Order issue resolved', 'Your order can continue. Check its latest status.'], ['Issue resolved', 'The reported issue has been cleared.'], ['Job issue resolved', 'Check your job for the next step.'], ['Order issue resolved', 'The reported issue has been cleared in operations.']);
  if (action === 'AssignmentDeclined' || action === 'AssignmentExpired' || action === 'AssignmentReplaced') options = copies(['Rider assignment updated', 'Another rider is being arranged for your laundry.'], ['Rider assignment changed', 'This order is waiting for another rider.'], ['Job assignment ended', 'Check your dashboard for other available jobs.'], ['Rider assignment changed', 'Review the current rider assignment.']);
  const [title, body] = (options || copies(['Order updated', 'Check your order for the latest update.'], ['Order updated', 'Check the order for the next step.'], ['Job updated', 'Check your job for the next step.'], ['Order updated', 'Review the order in operations.']))[role];
  return { title, message: `Order #${input.orderId}: ${body}` };
}

// Reword historical generic workflow notifications without rewriting stored data.
export function readableNotification<T extends { transactionId: number; title: string; message: string; audience?: string; shopMode?: boolean }>(item: T): T {
  if (typeof item.title !== 'string' || typeof item.message !== 'string') return item;
  const audience = item.shopMode ? 'partner' : item.audience || 'customer';
  let action = '';
  if (/^Rider arrived\s*[—-]/i.test(item.title)) action = 'HandoffArrived';
  if (/^Handover confirmed\s*[—-]/i.test(item.title)) action = 'HandoffReleased';
  if (/^(Pickup|Delivery) job claimed(?: by rider)?$/i.test(item.title)) action = 'JobClaimed';
  const legacyActions: Record<string,string> = { 'Measured weight and scale photo updated':'WeightAndPriceUpdated', 'Ready Estimate Updated':'ReadyEstimateUpdated', 'Issue Reported':'IssueReported', 'Assignment Expired':'AssignmentExpired', 'Assignment Replaced':'AssignmentReplaced' };
  action = action || legacyActions[item.title] || '';
  const legacyTitles: Record<string,string> = { 'Order accepted':'Accepted', 'Laundry received':'LaundryReceived', 'Processing started':'Processing', 'Laundry ready':'Ready', 'Order completed':'Completed', 'Order cancelled':'Cancelled', 'Washing started':'Washing', 'Drying started':'Drying' };
  const status = Object.keys(statuses).find(key => key === item.title.replace(/\s+/g, '')) || legacyTitles[item.title] || (action === 'JobClaimed' ? item.title.startsWith('Pickup') ? 'PickupAccepted' : 'DeliveryAccepted' : '');
  if (action || status) return { ...item, ...orderNotificationCopy({ audience, orderId: item.transactionId, action, status, detail: item.message }) };
  return { ...item, title: cleanNotificationText(item.title), message: cleanNotificationText(item.message) };
}
