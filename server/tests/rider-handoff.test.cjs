const assert = require('node:assert/strict');
const { test } = require('node:test');
const { riderHandoff } = require('../dist/controllers/notification.controller');
const order = { workflowStatus: 'PickupEnRoute', pickupCode: '123456', collectionCode: '234567', deliveryCode: '345678', assignments: [{ riderId: 7, status: 'Accepted', stage: 'Pickup' }] };

test('riders are not sent handoff codes in notification payloads', () => {
  assert.equal(riderHandoff(order, 7), undefined);
  assert.equal(riderHandoff(order, 8), undefined);
  for (const status of ['Offered', 'Reassigned', 'Cancelled', 'Completed', 'Expired']) {
    assert.equal(riderHandoff({ ...order, assignments: [{ ...order.assignments[0], status }] }, 7), undefined);
  }
  for (const workflowStatus of ['LaundryPickedUp', 'AtPartner', 'Cancelled', 'Completed']) assert.equal(riderHandoff({ ...order, workflowStatus }, 7), undefined);
});

test('delivery notifications do not expose shop collection or customer delivery codes', () => {
  const delivery = { ...order, assignments: [{ riderId: 7, status: 'Accepted', stage: 'Delivery' }] };
  for (const workflowStatus of ['DeliveryAccepted', 'CleanLaundryCollected', 'OutForDelivery']) assert.equal(riderHandoff({ ...delivery, workflowStatus }, 7), undefined);
  for (const workflowStatus of ['ReadyForDelivery', 'Delivered', 'Completed', 'Cancelled', 'PickupEnRoute']) assert.equal(riderHandoff({ ...delivery, workflowStatus }, 7), undefined);
});
