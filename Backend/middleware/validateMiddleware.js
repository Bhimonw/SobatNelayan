const { param, validationResult } = require('express-validator');

const validateAlatId = [
    param('alatId').isString().notEmpty().withMessage('alatId harus berupa string dan tidak boleh kosong'),
    (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        next();
    }
];

module.exports = { validateAlatId };
