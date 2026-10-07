class Transaction:
    def __init__(self, 
                 user_id=None, 
                 shop_id=None,
                 service_name=None,
                 kilo_amount=0.0,
                 subtotal=0.0,
                 delivery_fee=30.0,
                 voucher_discount=0.0,
                 delivery_address=None,
                 payment_method='Cash on Delivery',
                 scheduled_date=None,  
                 scheduled_time=None, 
                 notes=None,
                 items=None):
        # Required fields
        self.user_id = user_id
        self.shop_id = shop_id
        self.service_name = service_name
        self.kilo_amount = kilo_amount
        self.subtotal = subtotal
        self.scheduled_date = scheduled_date
        self.scheduled_time = scheduled_time

        # Optional fields with defaults
        self.delivery_fee = delivery_fee
        self.voucher_discount = voucher_discount
        self.delivery_address = delivery_address
        self.payment_method = payment_method
        self.notes = notes
        self.items = items if items is not None else {}

        # Status fields
        self.status = 'Pending'
        self.payment_status = 'Pending'

    def validate(self):
        if not all([self.user_id, self.shop_id, self.service_name, 
                   self.kilo_amount, self.scheduled_date, self.scheduled_time]):
            raise ValueError("Missing required fields")
        return True

    def to_dict(self):
        self.validate()
        return {
            'user_id': self.user_id,
            'shop_id': self.shop_id,
            'service_name': self.service_name,
            'kilo_amount': self.kilo_amount,
            'subtotal': self.subtotal,
            'delivery_fee': self.delivery_fee,
            'voucher_discount': self.voucher_discount,
            'delivery_address': self.delivery_address,
            'payment_method': self.payment_method,
            'scheduled_date': self.scheduled_date,
            'scheduled_time': self.scheduled_time,
            'notes': self.notes,
            'items': self.items,
            'total_amount': self.get_total(),
            'status': self.status,
            'payment_status': self.payment_status
        }

    def get_total(self):
        return self.subtotal + self.delivery_fee - self.voucher_discount