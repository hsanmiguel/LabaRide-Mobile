const assert = require('node:assert/strict');
const { test } = require('node:test');
const { riderHandoff } = require('../dist/controllers/notification.controller');
const order = { workflowStatus: 'PickupEnRoute', pickupCode: '123456', collectionCode: '234567', deliveryCode: '345678', assignments: [{ riderId: 7, status: 'Accepted', stage: 'Pickup' }] };

test('only the accepted assigned rider receives the current handoff code', () => {
  assert.deepEqual(riderHandoff(order, 7), { label: 'Customer laundry pickup', code: '123456' });
  assert.equal(riderHandoff(order, 8), undefined);
  for (const status of ['Offered', 'Reassigned', 'Cancelled', 'Completed', 'Expired']) {
    assert.equal(riderHandoff({ ...order, assignments: [{ ...order.assignments[0], status }] }, 7), undefined);
  }
  for (const workflowStatus of ['LaundryPickedUp', 'AtPartner', 'Cancelled', 'Completed']) assert.equal(riderHandoff({ ...order, workflowStatus }, 7), undefined);
});

test('delivery reveals shop collection then customer delivery code at the appropriate stage', () => {
  const delivery = { ...order, assignments: [{ riderId: 7, status: 'Accepted', stage: 'Delivery' }] };
  assert.equal(riderHandoff({ ...delivery, workflowStatus: 'DeliveryAccepted' }, 7).code, '234567');
  for (const workflowStatus of ['CleanLaundryCollected', 'OutForDelivery']) assert.equal(riderHandoff({ ...delivery, workflowStatus }, 7).code, '345678');
  for (const workflowStatus of ['ReadyForDelivery', 'Delivered', 'Completed', 'Cancelled', 'PickupEnRoute']) assert.equal(riderHandoff({ ...delivery, workflowStatus }, 7), undefined);
});
