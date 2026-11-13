// backend/server.js
const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
require('dotenv').config();

const db = require('./config/db');
const routes = require('./routes');
const socketManager = require('./sockets/socketManager');
const errorMiddleware = require('./middlewares/errorMiddleware');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: process.env.FRONTEND_URL || 'http://localhost:5173',
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
    }
});

app.set('io', io);
socketManager(io);

app.use(cors());
app.use(express.json());

// ============================================================================
// API HỖ TRỢ LẤY DỮ LIỆU TRỰC TIẾP TỪNG BẢNG CHO TRANG TEST LOCALHOST:5000
// ============================================================================
app.get('/api/debug/tables', async (req, res, next) => {
    try {
        const [tableList] = await db.query('SHOW TABLES');
        const tableNames = tableList.map((row) => Object.values(row)[0]);
        const selected = req.query.table && tableNames.includes(req.query.table) ? req.query.table : tableNames[0];
        const [rows] = await db.query(`SELECT * FROM \`${selected}\` ORDER BY 1 DESC LIMIT 50`);
        res.json({ tables: tableNames, activeTable: selected, rows });
    } catch (err) {
        next(err);
    }
});

// ============================================================================
// GIAO DIỆN WEB TEST TOÀN BỘ API & XEM BẢNG TRỰC TIẾP TẠI http://localhost:5000
// ============================================================================
app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8" />
    <title>Cafe Management - Local API Tester & DB Viewer</title>
    <style>
        * { box-sizing: border-box; font-family: 'Segoe UI', Tahoma, sans-serif; }
        body { margin: 0; background: #0f172a; color: #f8fafc; padding: 20px; }
        .top-bar { display: flex; justify-content: space-between; align-items: center; background: #1e293b; padding: 16px 24px; border-radius: 10px; margin-bottom: 20px; border: 1px solid #334155; }
        .top-bar h2 { margin: 0; color: #38bdf8; }
        .grid-layout { display: grid; grid-template-columns: 460px 1fr; gap: 20px; }
        .panel { background: #1e293b; padding: 18px; border-radius: 10px; border: 1px solid #334155; }
        .panel h3 { margin-top: 0; color: #fbbf24; border-bottom: 1px solid #334155; padding-bottom: 10px; }
        label { display: block; font-size: 13px; color: #94a3b8; margin: 10px 0 4px; font-weight: 600; }
        input, select, textarea { width: 100%; padding: 10px; border-radius: 6px; border: 1px solid #475569; background: #0f172a; color: #f8fafc; font-size: 13px; }
        textarea { font-family: Consolas, monospace; min-height: 150px; resize: vertical; }
        button { padding: 9px 14px; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; color: #fff; background: #2563eb; transition: 0.15s; }
        button:hover { opacity: 0.9; }
        .btn-green { background: #16a34a; }
        .btn-orange { background: #d97706; }
        .btn-purple { background: #7c3aed; }
        .role-btns { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }
        .role-btns button { font-size: 12px; padding: 6px 10px; }
        .table-tabs { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 14px; }
        .table-tabs button { background: #334155; font-size: 13px; padding: 7px 12px; }
        .table-tabs button.active { background: #0284c7; }
        pre { background: #020617; color: #4ade80; padding: 14px; border-radius: 8px; overflow-x: auto; max-height: 260px; font-size: 13px; border: 1px solid #1e293b; }
        .table-wrap { overflow-x: auto; max-height: 420px; }
        table { width: 100%; border-collapse: collapse; font-size: 13px; }
        th, td { border: 1px solid #334155; padding: 8px 10px; text-align: left; }
        th { background: #0f172a; color: #38bdf8; position: sticky; top: 0; }
        tr:nth-child(even) { background: #162032; }
        .status-badge { display: inline-block; padding: 4px 10px; border-radius: 4px; font-weight: bold; font-size: 12px; }
    </style>
</head>
<body>

    <div class="top-bar">
        <div>
            <h2>☕ Bảng Điều Khiển & Test API Local (http://localhost:5000)</h2>
            <small style="color:#94a3b8;">Kết nối trực tiếp Aiven MySQL (defaultdb) — Không cần dùng Postman</small>
        </div>
        <div>
            <a href="http://localhost:5173" target="_blank">
                <button class="btn-green">Mở Giao Diện React (http://localhost:5173) ➔</button>
            </a>
        </div>
    </div>

    <div class="grid-layout">
        <!-- CỘT TRÁI: BỘ TEST API TRỰC TIẾP -->
        <div class="panel">
            <h3>🚀 1. Công cụ Test API Theo Từng Bảng</h3>

            <label>Bước 1: Bấm chọn quyền để lấy JWT Token tự động</label>
            <div class="role-btns">
                <button class="btn-purple" onclick="quickLogin('admin@cafe.vn', '123456')">🔑 Token Admin</button>
                <button class="btn-orange" onclick="quickLogin('cashier@cafe.vn', '123456')">🔑 Token Thu ngân</button>
                <button class="btn-green" onclick="quickLogin('barista@cafe.vn', '123456')">🔑 Token Pha chế</button>
                <button onclick="quickLogin('customer@cafe.vn', '123456')">🔑 Token Khách hàng</button>
            </div>
            <input id="jwtToken" placeholder="JWT Bearer Token sẽ tự động điền vào đây..." style="margin-top:8px;" />

            <label>Bước 2: Chọn API Mẫu Của Từng Bảng Để Test</label>
            <select id="presetSelect" onchange="applyPreset()">
                <option value="">-- Chọn API của bảng cần test --</option>
                <optgroup label="1. Bảng users & Xác thực">
                    <option value="LOGIN">[POST] /api/auth/login (Đăng nhập nhận Role)</option>
                    <option value="REGISTER">[POST] /api/auth/register (Đăng ký Khách hàng)</option>
                    <option value="GET_STAFF">[GET] /api/admin/staff (Danh sách Nhân viên RBAC)</option>
                    <option value="CREATE_STAFF">[POST] /api/admin/staff (Tạo Nhân viên & Gán quyền)</option>
                </optgroup>
                <optgroup label="2. Bảng categories, products & product_options">
                    <option value="GET_CATALOG">[GET] /api/customer/catalog (Xem & Lọc Menu)</option>
                    <option value="ADD_CATEGORY">[POST] /api/admin/categories (Thêm Danh mục mới)</option>
                    <option value="ADD_PRODUCT">[POST] /api/admin/products (Thêm Món nước mới)</option>
                    <option value="ADD_OPTION">[POST] /api/admin/product-options (Thêm Topping/Size)</option>
                </optgroup>
                <optgroup label="3. Bảng areas & cafe_tables">
                    <option value="ADD_AREA">[POST] /api/admin/areas (Thêm Khu vực bàn)</option>
                    <option value="ADD_TABLE">[POST] /api/admin/tables (Thêm Bàn mới)</option>
                    <option value="TRANSFER_TABLE">[POST] /api/pos/transfer-table (Chuyển bàn POS)</option>
                    <option value="MERGE_TABLE">[POST] /api/pos/merge-tables (Gộp 2 bàn POS)</option>
                </optgroup>
                <optgroup label="4. Bảng ingredients & product_recipes (Kho BOM)">
                    <option value="GET_INVENTORY">[GET] /api/admin/inventory (Xem Kho & Định lượng BOM)</option>
                    <option value="ADD_INGREDIENT">[POST] /api/admin/ingredients (Nhập Nguyên liệu kho)</option>
                    <option value="SET_BOM">[POST] /api/admin/recipes-bom (Cài đặt Định lượng trừ tự động)</option>
                </optgroup>
                <optgroup label="5. Bảng orders & order_items (Đặt món, KDS, Thanh toán)">
                    <option value="CREATE_ORDER">[POST] /api/orders (Đặt món + Tự động trừ kho BOM)</option>
                    <option value="GET_KDS">[GET] /api/kds/orders (Danh sách đơn màn hình Pha chế)</option>
                    <option value="UPDATE_KDS">[PATCH] /api/kds/orders/1/status (Cập nhật Pha chế xong)</option>
                    <option value="PAY_ORDER">[POST] /api/pos/orders/1/pay (Thanh toán + Tích điểm CRM)</option>
                </optgroup>
                <optgroup label="6. Bảng vouchers, reviews & Thống kê">
                    <option value="GET_CRM">[GET] /api/admin/crm (Xem Khách hàng CRM & Voucher)</option>
                    <option value="ADD_VOUCHER">[POST] /api/admin/vouchers (Phát hành Voucher mới)</option>
                    <option value="ADD_REVIEW">[POST] /api/customer/reviews (Đánh giá 5 sao món nước)</option>
                    <option value="GET_ANALYTICS">[GET] /api/admin/analytics?period=day (Thống kê Doanh thu)</option>
                </optgroup>
            </select>

            <div style="display:grid; grid-template-columns: 110px 1fr; gap:8px; margin-top:10px;">
                <div>
                    <label>Method</label>
                    <select id="reqMethod">
                        <option value="GET">GET</option>
                        <option value="POST">POST</option>
                        <option value="PUT">PUT</option>
                        <option value="PATCH">PATCH</option>
                        <option value="DELETE">DELETE</option>
                    </select>
                </div>
                <div>
                    <label>Endpoint URL</label>
                    <input id="reqUrl" value="/api/health-db" />
                </div>
            </div>

            <label>JSON Body (Dùng cho POST / PUT / PATCH)</label>
            <textarea id="reqBody">{}</textarea>

            <button class="btn-green" style="width:100%; margin-top:12px; padding:12px;" onclick="sendApiRequest()">
                ⚡ GỬI REQUEST TEST API NGAY
            </button>
        </div>

        <!-- CỘT PHẢI: KẾT QUẢ JSON & DỮ LIỆU BẢNG TRỰC TIẾP -->
        <div>
            <div class="panel" style="margin-bottom:20px;">
                <h3>📡 2. Kết quả Phản hồi từ API (JSON Response) <span id="resStatus" class="status-badge"></span></h3>
                <pre id="resOutput">Hãy bấm nút "GỬI REQUEST TEST API NGAY" ở cột bên trái để xem kết quả...</pre>
            </div>

            <div class="panel">
                <h3>📦 3. Dữ liệu Trực tiếp 12 Bảng trên Aiven MySQL (Tự động làm mới khi Test API)</h3>
                <div id="tableTabs" class="table-tabs"></div>
                <div class="table-wrap" id="tableContent">Đang tải dữ liệu từ Aiven MySQL...</div>
            </div>
        </div>
    </div>

    <script>
        let currentTable = 'users';

        const PRESETS = {
            LOGIN: { method: 'POST', url: '/api/auth/login', table: 'users', body: { email: 'admin@cafe.vn', password: '123456' } },
            REGISTER: { method: 'POST', url: '/api/auth/register', table: 'users', body: { full_name: 'Khách Hàng Test Local', email: 'testlocal@cafe.vn', phone: '0909888777', password: '123456' } },
            GET_STAFF: { method: 'GET', url: '/api/admin/staff', table: 'users', body: {} },
            CREATE_STAFF: { method: 'POST', url: '/api/admin/staff', table: 'users', body: { full_name: 'Nhân Viên Pha Chế Mới', email: 'barista_new@cafe.vn', phone: '0912345678', password: '123456', role: 'barista' } },
            GET_CATALOG: { method: 'GET', url: '/api/customer/catalog?sort_by=best_selling', table: 'products', body: {} },
            ADD_CATEGORY: { method: 'POST', url: '/api/admin/categories', table: 'categories', body: { name: 'Đá Xay Freeze', is_visible: true } },
            ADD_PRODUCT: { method: 'POST', url: '/api/admin/products', table: 'products', body: { category_id: 1, name: 'Cold Brew Cam Sả', description: 'Cà phê ủ lạnh 16 tiếng', base_price: 49000, calories: 110, is_available: true, is_visible: true } },
            ADD_OPTION: { method: 'POST', url: '/api/admin/product-options', table: 'product_options', body: { option_group: 'topping', option_name: 'pudding trứng', extra_price: 10000 } },
            ADD_AREA: { method: 'POST', url: '/api/admin/areas', table: 'areas', body: { name: 'Ban Công Tầng 2', description: 'Không gian thoáng mát' } },
            ADD_TABLE: { method: 'POST', url: '/api/admin/tables', table: 'cafe_tables', body: { area_id: 1, table_number: 'T09', capacity: 6, status: 'empty' } },
            TRANSFER_TABLE: { method: 'POST', url: '/api/pos/transfer-table', table: 'cafe_tables', body: { fromTableId: 1, toTableId: 2 } },
            MERGE_TABLE: { method: 'POST', url: '/api/pos/merge-tables', table: 'cafe_tables', body: { sourceTableId: 1, targetTableId: 2 } },
            GET_INVENTORY: { method: 'GET', url: '/api/admin/inventory', table: 'ingredients', body: {} },
            ADD_INGREDIENT: { method: 'POST', url: '/api/admin/ingredients', table: 'ingredients', body: { name: 'Sirô Đào Pháp', unit: 'ml', stock_quantity: 4000, min_threshold: 400 } },
            SET_BOM: { method: 'POST', url: '/api/admin/recipes-bom', table: 'product_recipes', body: { product_id: 1, ingredient_id: 1, quantity_required: 25 } },
            CREATE_ORDER: { method: 'POST', url: '/api/orders', table: 'orders', body: { table_id: 2, order_type: 'dine_in', voucher_code: 'CAFE10', items: [{ product_id: 1, quantity: 2, unit_price: 35000, custom_options: { size: 'L', sugar: '70%', ice: '100%' } }] } },
            GET_KDS: { method: 'GET', url: '/api/kds/orders', table: 'orders', body: {} },
            UPDATE_KDS: { method: 'PATCH', url: '/api/kds/orders/1/status', table: 'orders', body: { status: 'ready' } },
            PAY_ORDER: { method: 'POST', url: '/api/pos/orders/1/pay', table: 'orders', body: { payment_method: 'qr' } },
            GET_CRM: { method: 'GET', url: '/api/admin/crm', table: 'vouchers', body: {} },
            ADD_VOUCHER: { method: 'POST', url: '/api/admin/vouchers', table: 'vouchers', body: { code: 'SUMMER20', discount_type: 'percent', discount_value: 20, min_order_value: 60000, required_tier: 'standard', expires_at: '2027-12-31 23:59:59' } },
            ADD_REVIEW: { method: 'POST', url: '/api/customer/reviews', table: 'reviews', body: { product_id: 1, order_id: 1, rating: 5, comment: 'Cà phê rất thơm ngon!' } },
            GET_ANALYTICS: { method: 'GET', url: '/api/admin/analytics?period=day', table: 'orders', body: {} }
        };

        function applyPreset() {
            const key = document.getElementById('presetSelect').value;
            if (!PRESETS[key]) return;
            const p = PRESETS[key];
            document.getElementById('reqMethod').value = p.method;
            document.getElementById('reqUrl').value = p.url;
            document.getElementById('reqBody').value = JSON.stringify(p.body, null, 2);
            if (p.table) loadTableData(p.table);
        }

        async function quickLogin(email, password) {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            const data = await res.json();
            if (data.token) {
                document.getElementById('jwtToken').value = data.token;
                document.getElementById('resStatus').textContent = '200 OK - Đã lấy Token ' + data.user.role.toUpperCase();
                document.getElementById('resStatus').style.background = '#16a34a';
                document.getElementById('resOutput').textContent = JSON.stringify(data, null, 2);
            } else {
                alert(data.message || 'Lỗi đăng nhập!');
            }
        }

        async function sendApiRequest() {
            const method = document.getElementById('reqMethod').value;
            const url = document.getElementById('reqUrl').value;
            const token = document.getElementById('jwtToken').value.trim();
            const rawBody = document.getElementById('reqBody').value;

            const headers = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = 'Bearer ' + token;

            const options = { method, headers };
            if (['POST', 'PUT', 'PATCH'].includes(method) && rawBody.trim() !== '') {
                options.body = rawBody;
            }

            try {
                const start = performance.now();
                const res = await fetch(url, options);
                const duration = Math.round(performance.now() - start);
                const data = await res.json().catch(() => ({}));

                const badge = document.getElementById('resStatus');
                badge.textContent = res.status + ' (' + duration + 'ms)';
                badge.style.background = res.ok ? '#16a34a' : '#dc2626';

                document.getElementById('resOutput').textContent = JSON.stringify(data, null, 2);
                loadTableData(currentTable);
            } catch (err) {
                document.getElementById('resOutput').textContent = 'Lỗi kết nối: ' + err.message;
            }
        }

        async function loadTableData(tableName) {
            currentTable = tableName || currentTable;
            const res = await fetch('/api/debug/tables?table=' + currentTable);
            const data = await res.json();

            const tabsDiv = document.getElementById('tableTabs');
            tabsDiv.innerHTML = data.tables.map(t =>
                '<button class="' + (t === data.activeTable ? 'active' : '') + '" onclick="loadTableData(\\'' + t + '\\')">📋 ' + t + '</button>'
            ).join('');

            const container = document.getElementById('tableContent');
            if (!data.rows || data.rows.length === 0) {
                container.innerHTML = '<p>Bảng <b>' + data.activeTable + '</b> hiện đang trống.</p>';
                return;
            }

            const cols = Object.keys(data.rows[0]);
            container.innerHTML = '<table><thead><tr>' +
                cols.map(c => '<th>' + c + '</th>').join('') +
                '</tr></thead><tbody>' +
                data.rows.map(r => '<tr>' + cols.map(c => '<td>' + (typeof r[c] === 'object' && r[c] !== null ? JSON.stringify(r[c]) : (r[c] ?? '')) + '</td>').join('') + '</tr>').join('') +
                '</tbody></table>';
        }

        loadTableData('users');
    </script>
</body>
</html>
    `);
});

app.use('/api', routes);
app.use(errorMiddleware);

const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server đang chạy tại port ${PORT}`);
});