const express = require('express');
const mongoose = require('mongoose');

const Cart = require('../models/Cart');
const Order = require('../models/Order');
const Product = require('../models/Product');
const ApiError = require('../utils/ApiError');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

function validateAddress(address) {
  const fields = ['fullName', 'phone', 'addressLine1', 'city', 'postalCode', 'country'];
  if (!address || fields.some((field) =>
    typeof address[field] !== 'string' || !address[field].trim() || address[field].length > 200)) {
    throw new ApiError(400, 'A complete, valid shippingAddress is required.');
  }
  return {
    fullName: address.fullName.trim(),
    phone: address.phone.trim(),
    addressLine1: address.addressLine1.trim(),
    addressLine2: typeof address.addressLine2 === 'string' ? address.addressLine2.trim() : '',
    city: address.city.trim(),
    postalCode: address.postalCode.trim(),
    country: address.country.trim(),
  };
}

router.post('/', async (req, res) => {
  const shippingAddress = validateAddress(req.body && req.body.shippingAddress);
  const paymentMethod = (req.body && req.body.paymentMethod) || 'cash_on_delivery';
  if (!['cash_on_delivery', 'online'].includes(paymentMethod)) {
    throw new ApiError(400, 'paymentMethod must be cash_on_delivery or online.');
  }

  const session = await mongoose.startSession();
  let order;
  try {
    await session.withTransaction(async () => {
      const cart = await Cart.findOne({ user: req.auth.userId }).session(session);
      if (!cart || cart.items.length === 0) {
        throw new ApiError(400, 'Your cart is empty.');
      }

      const orderItems = [];
      let subtotal = 0;
      for (const cartItem of cart.items) {
        const product = await Product.findOneAndUpdate(
          {
            _id: cartItem.product,
            isActive: true,
            stock: { $gte: cartItem.quantity },
          },
          { $inc: { stock: -cartItem.quantity } },
          { new: true, session },
        );
        if (!product) {
          throw new ApiError(409, 'A product in your cart is unavailable or has insufficient stock.');
        }
        orderItems.push({
          product: product._id,
          name: product.name,
          unitPrice: product.price,
          quantity: cartItem.quantity,
        });
        subtotal += product.price * cartItem.quantity;
      }

      const [createdOrder] = await Order.create([{
        user: req.auth.userId,
        items: orderItems,
        shippingAddress,
        subtotal: Math.round(subtotal * 100) / 100,
        paymentMethod,
      }], { session });
      order = createdOrder;
      await Cart.deleteOne({ user: req.auth.userId }, { session });
    });
  } finally {
    await session.endSession();
  }

  res.status(201).json({ order });
});

router.get('/', async (req, res) => {
  const page = Number.parseInt(req.query.page, 10) || 1;
  const limit = Number.parseInt(req.query.limit, 10) || 20;
  if (page < 1 || limit < 1 || limit > 100) {
    throw new ApiError(400, 'page must be positive and limit must be between 1 and 100.');
  }
  const filter = req.auth.role === 'admin' ? {} : { user: req.auth.userId };
  const [orders, total] = await Promise.all([
    Order.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    Order.countDocuments(filter),
  ]);
  res.json({ orders, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
});

router.get('/:id', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    throw new ApiError(400, 'Invalid order identifier.');
  }
  const filter = { _id: req.params.id };
  if (req.auth.role !== 'admin') filter.user = req.auth.userId;
  const order = await Order.findOne(filter);
  if (!order) {
    throw new ApiError(404, 'Order not found.');
  }
  res.json({ order });
});

router.patch('/:id/status', requireAdmin, async (req, res) => {
  const { status } = req.body || {};
  const transitions = {
    pending: ['processing', 'cancelled'],
    processing: ['shipped', 'cancelled'],
    shipped: ['delivered'],
    delivered: [],
    cancelled: [],
  };
  if (!Object.prototype.hasOwnProperty.call(transitions, status)) {
    throw new ApiError(400, 'Invalid order status.');
  }
  if (!mongoose.isValidObjectId(req.params.id)) {
    throw new ApiError(400, 'Invalid order identifier.');
  }

  const session = await mongoose.startSession();
  let order;
  try {
    await session.withTransaction(async () => {
      order = await Order.findById(req.params.id).session(session);
      if (!order) {
        throw new ApiError(404, 'Order not found.');
      }
      if (!transitions[order.status].includes(status)) {
        throw new ApiError(409, `Cannot change order status from ${order.status} to ${status}.`);
      }
      if (status === 'cancelled') {
        for (const item of order.items) {
          await Product.updateOne(
            { _id: item.product },
            { $inc: { stock: item.quantity } },
            { session },
          );
        }
      }
      order.status = status;
      await order.save({ session });
    });
  } finally {
    await session.endSession();
  }
  res.json({ order });
});

module.exports = router;
