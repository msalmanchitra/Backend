const express = require('express');

const Cart = require('../models/Cart');
const Product = require('../models/Product');
const ApiError = require('../utils/ApiError');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

async function loadCart(userId) {
  let cart = await Cart.findOne({ user: userId });
  if (!cart) {
    cart = await Cart.create({ user: userId, items: [] });
  }
  return cart;
}

router.get('/', async (req, res) => {
  const cart = await Cart.findOne({ user: req.auth.userId }).populate(
    'items.product',
    'name price images stock isActive',
  );
  res.json({ cart: cart || { items: [] } });
});

router.post('/items', async (req, res) => {
  const { productId, quantity } = req.body || {};
  if (typeof productId !== 'string' || !Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
    throw new ApiError(400, 'productId and a quantity from 1 to 99 are required.');
  }
  const product = await Product.findOne({ _id: productId, isActive: true });
  if (!product) {
    throw new ApiError(404, 'Product not found.');
  }

  const cart = await loadCart(req.auth.userId);
  const item = cart.items.find((entry) => entry.product.toString() === productId);
  const newQuantity = (item ? item.quantity : 0) + quantity;
  if (newQuantity > 99 || newQuantity > product.stock) {
    throw new ApiError(409, 'Requested quantity is not available in stock.');
  }
  if (item) item.quantity = newQuantity;
  else cart.items.push({ product: product._id, quantity });

  await cart.save();
  await cart.populate('items.product', 'name price images stock isActive');
  res.status(201).json({ cart });
});

router.patch('/items/:productId', async (req, res) => {
  const { quantity } = req.body || {};
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
    throw new ApiError(400, 'quantity must be an integer from 1 to 99.');
  }
  const product = await Product.findOne({ _id: req.params.productId, isActive: true });
  if (!product) {
    throw new ApiError(404, 'Product not found.');
  }
  if (quantity > product.stock) {
    throw new ApiError(409, 'Requested quantity is not available in stock.');
  }

  const cart = await Cart.findOne({ user: req.auth.userId });
  const item = cart && cart.items.find((entry) => entry.product.toString() === req.params.productId);
  if (!item) {
    throw new ApiError(404, 'Product is not in your cart.');
  }
  item.quantity = quantity;
  await cart.save();
  await cart.populate('items.product', 'name price images stock isActive');
  res.json({ cart });
});

router.delete('/items/:productId', async (req, res) => {
  const cart = await Cart.findOne({ user: req.auth.userId });
  if (!cart) {
    throw new ApiError(404, 'Cart item not found.');
  }
  const previousLength = cart.items.length;
  cart.items = cart.items.filter((item) => item.product.toString() !== req.params.productId);
  if (cart.items.length === previousLength) {
    throw new ApiError(404, 'Cart item not found.');
  }
  await cart.save();
  res.json({ cart });
});

router.delete('/', async (req, res) => {
  await Cart.deleteOne({ user: req.auth.userId });
  res.json({ message: 'Cart cleared.' });
});

module.exports = router;