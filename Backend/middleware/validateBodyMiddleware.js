const { body, validationResult } = require('express-validator');

const validatePostBody = [
    body('title').isString().notEmpty().withMessage('title harus berupa string dan tidak boleh kosong'),
    body('content').isString().notEmpty().withMessage('content harus berupa string dan tidak boleh kosong'),
    body('imageUrl').optional().isString(),
    body('category').isString().notEmpty().withMessage('category harus berupa string dan tidak boleh kosong'),
    (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        next();
    }
];

module.exports = { validatePostBody };
