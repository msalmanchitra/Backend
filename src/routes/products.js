const express = require('express');
const mongoose = require('mongoose');

const Product = require('../models/Product');
const ApiError = require('../utils/ApiError');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function validateProductInput(body, partial) {
  const fields = ['name', 'description', 'category', 'price', 'stock', 'images', 'isActive'];
  const input = {};
  for (const field of fields) {
    if (body[field] !== undefined) {
      input[field] = body[field];
    }
  }

  if (!partial) {
    for (const field of ['name', 'description', 'category', 'price', 'stock']) {
      if (input[field] === undefined) {
        throw new ApiError(400, `${field} is required.`);
      }
    }
  }

  for (const field of ['name', 'description', 'category']) {
    if (input[field] !== undefined && (typeof input[field] !== 'string' || !input[field].trim())) {
      throw new ApiError(400, `${field} must be a non-empty string.`);
    }
  }
  if (input.price !== undefined && (!Number.isFinite(input.price) || input.price < 0)) {
    throw new ApiError(400, 'price must be a non-negative number.');
  }
  if (input.stock !== undefined && (!Number.isInteger(input.stock) || input.stock < 0)) {
    throw new ApiError(400, 'stock must be a non-negative integer.');
  }
  if (input.images !== undefined &&
      (!Array.isArray(input.images) || input.images.length > 10 ||
       input.images.some((image) => typeof image !== 'string' || image.length > 2048))) {
    throw new ApiError(400, 'images must be an array of up to 10 image URLs.');
  }
  if (input.isActive !== undefined && typeof input.isActive !== 'boolean') {
    throw new ApiError(400, 'isActive must be a boolean.');
  }
  return input;
}

router.get('/', async (req, res) => {
  const page = Number.parseInt(req.query.page, 10) || 1;
  const limit = Number.parseInt(req.query.limit, 10) || 20;
  if (page < 1 || limit < 1 || limit > 100) {
    throw new ApiError(400, 'page must be positive and limit must be between 1 and 100.');
  }

  const filter = { isActive: true };
  if (typeof req.query.category === 'string' && req.query.category.trim()) {
    filter.category = new RegExp(`^${escapeRegex(req.query.category.trim())}$`, 'i');
  }
  if (typeof req.query.search === 'string' && req.query.search.trim()) {
    if (req.query.search.length > 100) {
      throw new ApiError(400, 'search must be at most 100 characters.');
    }
    const search = new RegExp(escapeRegex(req.query.search.trim()), 'i');
    filter.$or = [{ name: search }, { description: search }, { category: search }];
  }

  const sortOptions = {
    newest: { createdAt: -1 },
    price_asc: { price: 1 },
    price_desc: { price: -1 },
  };
  const sort = sortOptions[req.query.sort] || sortOptions.newest;
  const [products, total] = await Promise.all([
    Product.find(filter).sort(sort).skip((page - 1) * limit).limit(limit),
    Product.countDocuments(filter),
  ]);
  res.json({ products, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
});

router.get('/:id', async (req, res) => {
  const product = await Product.findOne({ _id: req.params.id, isActive: true });
  if (!product) {
    throw new ApiError(404, 'Product not found.');
  }
  res.json({ product });
});

router.post('/', authenticate, requireAdmin, async (req, res) => {
  const product = await Product.create(validateProductInput(req.body || {}, false));
  res.status(201).json({ product });
});

router.patch('/:id', authenticate, requireAdmin, async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    throw new ApiError(400, 'Invalid product identifier.');
  }
  const input = validateProductInput(req.body || {}, true);
  if (!Object.keys(input).length) {
    throw new ApiError(400, 'Provide at least one product field to update.');
  }
  for (const field of ['name', 'description', 'category']) {
    if (input[field] !== undefined) input[field] = input[field].trim();
  }
  const product = await Product.findByIdAndUpdate(req.params.id, input, {
    new: true,
    runValidators: true,
  });
  if (!product) {
    throw new ApiError(404, 'Product not found.');
  }
  res.json({ product });
});

router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    throw new ApiError(400, 'Invalid product identifier.');
  }
  const product = await Product.findByIdAndUpdate(
    req.params.id,
    { isActive: false },
    { new: true },
  );
  if (!product) {
    throw new ApiError(404, 'Product not found.');
  }
  res.json({ message: 'Product archived.' });
});

module.exports = router;
