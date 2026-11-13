// backend/config/constants.js
exports.ROLES = {
    CUSTOMER: 'customer',
    CASHIER: 'cashier',
    BARISTA: 'barista',
    WAITER: 'waiter',
    ADMIN: 'admin'
};

exports.ROLE_REDIRECT_MAP = {
    admin: '/admin/dashboard',
    cashier: '/pos/workspace',
    waiter: '/pos/workspace',
    barista: '/kds/live-board',
    customer: '/customer/menu'
};

exports.CRM_TIERS = {
    STANDARD: 'standard',
    LOYAL: 'loyal',
    VIP: 'vip'
};