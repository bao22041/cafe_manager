// frontend/src/pages/staff/PosWorkspace.jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axiosClient from '../../api/axiosClient';
import { useSocket } from '../../context/SocketContext';
import FloorTableMap from '../../components/staff/FloorTableMap';
import TableMergeTransferModal from '../../components/staff/TableMergeTransferModal';
import BillSplitModal from '../../components/staff/BillSplitModal';
import PaymentCheckoutModal from '../../components/staff/PaymentCheckoutModal';
import ThermalReceiptPrint from '../../components/staff/ThermalReceiptPrint';

// Các tùy chọn Đường & Đá chỉ áp dụng cho Thức uống
const SUGAR_LEVELS = ['100% đường', '70% đường', '50% đường', '30% đường', 'Không đường'];
const ICE_LEVELS = ['100% đá', '70% đá', '50% đá', 'Ít đá', 'Không đá', 'Đá riêng'];

// Gợi ý nhanh cho Đồ ăn (Không có đường & đá)
const FOOD_QUICK_NOTES = ['Hâm nóng', 'Cắt nhỏ', 'Để hộp riêng', 'Thêm tương ớt', 'Không sốt'];

// Hàm nhận diện món là Đồ ăn (Food) hay Thức uống (Drink)
const checkIsFood = (product, categories = []) => {
    if (!product) return false;
    if (product.item_type === 'drink' || product.type === 'drink' || product.is_food === false || product.is_food === 0) {
        return false;
    }
    if (product.item_type === 'food' || product.type === 'food' || product.is_food === true || product.is_food === 1) {
        return true;
    }
    const productName = (product.name || '').toLowerCase();
    const drinkKeywords = [
        'trà ', 'trà đào', 'trà vải', 'trà dâu', 'trà ổi', 'trà tắc', 'trà chanh', 'trà sen',
        'trà sữa', 'ô long', 'cà phê', 'cafe', 'bạc xỉu', 'macchiato', 'matcha', 'sinh tố', 'nước ép'
    ];
    if (drinkKeywords.some((kw) => productName.includes(kw))) {
        return false;
    }
    const catObj = categories.find((c) => Number(c.id) === Number(product.category_id));
    if (catObj?.category_type === 'food' || product.category_type === 'food') return true;
    if (catObj?.category_type === 'drink' || product.category_type === 'drink') return false;

    const combinedText = `${productName} ${product.description || ''}`.toLowerCase();
    const foodKeywords = [
        'đồ ăn', '[đồ ăn]', 'thức ăn', 'bánh', 'ăn vặt', 'snack', 'food', 'bakery', 'pastry',
        'croissant', 'tiramisu', 'mousse', 'cheesecake', 'flan', 'cookie', 'macaron'
    ];
    return foodKeywords.some((kw) => combinedText.includes(kw));
};

export default function PosWorkspace() {
    const socket = useSocket();
    const [tables, setTables] = useState([]);
    const [categories, setCategories] = useState([]);
    const [products, setProducts] = useState([]);
    const [activeOrders, setActiveOrders] = useState([]);
    const [selectedTable, setSelectedTable] = useState(null);
    const [orderDetails, setOrderDetails] = useState(null);

    // Giỏ hàng & Cấu hình đặt món của Thu ngân / Phục vụ
    const [posCart, setPosCart] = useState([]);
    const [posOrderType, setPosOrderType] = useState('dine_in');
    const [posDeliveryAddress, setPosDeliveryAddress] = useState('');

    // Bộ lọc phân loại Đồ ăn / Thức uống & Tìm kiếm món nhanh cho Thu ngân
    const [itemGroupFilter, setItemGroupFilter] = useState('ALL'); // 'ALL' | 'DRINK' | 'FOOD'
    const [selectedCategoryId, setSelectedCategoryId] = useState('ALL');
    const [searchKeyword, setSearchKeyword] = useState('');

    // Modal chọn số lượng & tùy chọn món (Ẩn đường/đá nếu là Đồ ăn)
    const [customizingProduct, setCustomizingProduct] = useState(null);
    const [itemQty, setItemQty] = useState(1);
    const [selectedSugar, setSelectedSugar] = useState('100% đường');
    const [selectedIce, setSelectedIce] = useState('100% đá');
    const [itemNote, setItemNote] = useState('');

    const loadPosData = useCallback(async () => {
        try {
            const [catRes, ordRes] = await Promise.all([
                axiosClient.get('/customer/catalog'),
                axiosClient.get('/pos/active-orders')
            ]);
            setTables(catRes.data?.tables || []);
            setCategories(catRes.data?.categories || []);
            setProducts(catRes.data?.products || []);
            setActiveOrders(Array.isArray(ordRes.data) ? ordRes.data : []);
        } catch (err) {
            console.error('Lỗi tải dữ liệu POS:', err);
        }
    }, []);

    useEffect(() => {
        loadPosData();
    }, [loadPosData]);

    useEffect(() => {
        if (!socket) return;
        const handleSync = () => loadPosData();
        const handleKdsReady = (d) => {
            loadPosData();
            alert(`🔔 KDS BÁO PHA XONG: Đơn #${d.orderId} (${(d.order_type || '').toUpperCase()}) đã sẵn sàng!`);
        };
        socket.on('GLOBAL_SYNC', handleSync);
        socket.on('TABLE_MAP_UPDATED', handleSync);
        socket.on('KDS_ORDER_READY', handleKdsReady);
        return () => {
            socket.off('GLOBAL_SYNC', handleSync);
            socket.off('TABLE_MAP_UPDATED', handleSync);
            socket.off('KDS_ORDER_READY', handleKdsReady);
        };
    }, [socket, loadPosData]);

    // Lọc danh sách danh mục hiển thị trên POS đúng theo tab Tất cả / Thức uống / Đồ ăn
    const visibleCategoriesForPos = useMemo(() => {
        return (categories || []).filter((cat) => {
            const isFoodCat =
                cat.category_type === 'food' ||
                (String(cat.name || '').toLowerCase().includes('bánh') &&
                    !String(cat.name || '').toLowerCase().includes('trà'));
            if (itemGroupFilter === 'DRINK') return !isFoodCat;
            if (itemGroupFilter === 'FOOD') return isFoodCat;
            return true;
        });
    }, [categories, itemGroupFilter]);

    // Chuẩn hóa danh sách sản phẩm với cờ is_food và đơn vị tính: Đồ ăn ('cái') / Thức uống ('ly')
    const normalizedProducts = useMemo(() => {
        return (products || []).map((p) => {
            const isFood = checkIsFood(p, categories);
            return {
                ...p,
                is_food: isFood,
                unit_label: isFood ? 'cái' : 'ly',
                sold_count_num: Number(p.sold_count || 0)
            };
        });
    }, [products, categories]);

    // Lọc danh sách món theo tab Tất cả / Thức uống / Đồ ăn, danh mục và từ khóa
    const filteredMenuProducts = useMemo(() => {
        return normalizedProducts.filter((p) => {
            if (!p.is_available) return false;
            if (itemGroupFilter === 'DRINK' && p.is_food) return false;
            if (itemGroupFilter === 'FOOD' && !p.is_food) return false;
            if (selectedCategoryId !== 'ALL' && Number(p.category_id) !== Number(selectedCategoryId)) {
                return false;
            }
            if (searchKeyword.trim()) {
                const kw = searchKeyword.toLowerCase().trim();
                if (!(p.name || '').toLowerCase().includes(kw)) return false;
            }
            return true;
        });
    }, [normalizedProducts, itemGroupFilter, selectedCategoryId, searchKeyword]);

    // Kiểm tra xem bàn đang chọn có hóa đơn đang mở hay không (để hiển thị chế độ Gọi thêm món)
    const activeOrderOnSelectedTable = useMemo(() => {
        if (!selectedTable) return null;
        return activeOrders.find(
            (o) =>
                (Number(o.id) === Number(selectedTable.current_order_id) ||
                    Number(o.table_id) === Number(selectedTable.id)) &&
                o.payment_status === 'unpaid'
        );
    }, [selectedTable, activeOrders]);

    // Khi bấm vào 1 bàn trên sơ đồ hoặc chọn bàn từ danh sách của Thu ngân
    const handleSelectTable = async (t) => {
        if (!t) {
            setSelectedTable(null);
            setOrderDetails(null);
            return;
        }
        setSelectedTable(t);
        setPosOrderType('dine_in');
        const orderIdToLoad =
            t.current_order_id ||
            activeOrders.find((o) => Number(o.table_id) === Number(t.id) && o.payment_status === 'unpaid')?.id;
        if (orderIdToLoad) {
            try {
                const res = await axiosClient.get(`/pos/orders/${orderIdToLoad}`);
                setOrderDetails(res.data);
            } catch (err) {
                setOrderDetails(null);
            }
        } else {
            setOrderDetails(null);
        }
    };

    // Khi bấm vào 1 đơn trong bảng danh sách đơn đang hoạt động
    const handleSelectActiveOrder = async (ord) => {
        try {
            const res = await axiosClient.get(`/pos/orders/${ord.id}`);
            setOrderDetails(res.data);
            if (ord.table_id) {
                const foundTable = tables.find((t) => Number(t.id) === Number(ord.table_id));
                setSelectedTable(foundTable || null);
                setPosOrderType('dine_in');
            } else {
                setSelectedTable(null);
            }
        } catch (err) {
            console.error('Lỗi tải chi tiết đơn:', err);
        }
    };

    // Đặt trước bàn (Reserve) hoặc Mở lại bàn trống
    const handleToggleReserveTable = async (nextStatus) => {
        if (!selectedTable) return;
        try {
            await axiosClient.patch(`/pos/tables/${selectedTable.id}/status`, { status: nextStatus });
            await loadPosData();
            setSelectedTable((prev) => (prev ? { ...prev, status: nextStatus } : null));
        } catch (err) {
            alert(err.response?.data?.message || 'Lỗi cập nhật trạng thái bàn');
        }
    };

    // Khi Thu ngân bấm vào 1 món trên menu -> Mở bảng tùy chỉnh theo loại Đồ ăn / Thức uống
    const handleOpenCustomizeModal = (product) => {
        setCustomizingProduct(product);
        setItemQty(1);
        if (product.is_food) {
            setSelectedSugar('');
            setSelectedIce('');
        } else {
            setSelectedSugar('100% đường');
            setSelectedIce('100% đá');
        }
        setItemNote('');
    };

    // Xác nhận thêm món vào giỏ gọi món của Thu ngân
    const handleConfirmAddItemToPosCart = () => {
        if (!customizingProduct) return;
        const isFood = customizingProduct.is_food;
        const unitLabel = customizingProduct.unit_label;
        const cleanNote = itemNote.trim();

        const customOptions = isFood
            ? {
                  is_food: true,
                  unit: 'cái',
                  note: cleanNote
              }
            : {
                  is_food: false,
                  unit: 'ly',
                  sugar: selectedSugar,
                  ice: selectedIce,
                  note: cleanNote
              };

        const cartKey = `${customizingProduct.id}_${isFood ? 'food' : `${selectedSugar}_${selectedIce}`}_${cleanNote}`;

        setPosCart((prev) => {
            const existingIdx = prev.findIndex((item) => item.cartKey === cartKey);
            if (existingIdx > -1) {
                const updated = [...prev];
                updated[existingIdx].quantity += Number(itemQty);
                return updated;
            }
            return [
                ...prev,
                {
                    cartKey,
                    product_id: customizingProduct.id,
                    name: customizingProduct.name,
                    is_food: isFood,
                    unit_label: unitLabel,
                    quantity: Number(itemQty),
                    unit_price: Number(customizingProduct.base_price),
                    custom_options: customOptions
                }
            ];
        });
        setCustomizingProduct(null);
    };

    // Tăng / giảm số lượng hoặc xóa món trong giỏ của Thu ngân
    const handleUpdateCartQty = (cartKey, delta) => {
        setPosCart((prev) =>
            prev
                .map((item) => {
                    if (item.cartKey === cartKey) {
                        const nextQty = item.quantity + delta;
                        return nextQty > 0 ? { ...item, quantity: nextQty } : null;
                    }
                    return item;
                })
                .filter(Boolean)
        );
    };

    const handleRemoveCartItem = (cartKey) => {
        setPosCart((prev) => prev.filter((item) => item.cartKey !== cartKey));
    };

    const posCartTotalAmount = useMemo(() => {
        return posCart.reduce((sum, item) => sum + Number(item.unit_price) * Number(item.quantity), 0);
    }, [posCart]);

    const posCartTotalCount = useMemo(() => {
        return posCart.reduce((sum, item) => sum + Number(item.quantity), 0);
    }, [posCart]);

    // Tạo đơn tại quầy
    const createPosOrder = async () => {
        if (posCart.length === 0) return alert('Vui lòng chọn ít nhất 1 món ăn hoặc thức uống!');
        if (posOrderType === 'dine_in' && !selectedTable) {
            return alert('Vui lòng chọn 1 bàn (trên sơ đồ hoặc ở ô chọn bàn) trước khi xác nhận!');
        }
        if (posOrderType === 'delivery' && !posDeliveryAddress.trim()) {
            return alert('Vui lòng nhập địa chỉ & SĐT khách nhận hàng cho đơn Ship!');
        }
        try {
            const isAddingToOccupiedTable = posOrderType === 'dine_in' && activeOrderOnSelectedTable;
            const res = await axiosClient.post('/orders', {
                table_id: posOrderType === 'dine_in' ? selectedTable.id : null,
                order_type: posOrderType,
                delivery_address: posOrderType === 'delivery' ? posDeliveryAddress : null,
                items: posCart.map((c) => ({
                    product_id: c.product_id,
                    quantity: c.quantity,
                    unit_price: c.unit_price,
                    is_food: c.is_food,
                    custom_options: c.custom_options
                }))
            });
            setPosCart([]);
            setPosDeliveryAddress('');
            await loadPosData();
            const detailRes = await axiosClient.get(`/pos/orders/${res.data.orderId}`);
            setOrderDetails(detailRes.data);
            if (isAddingToOccupiedTable) {
                alert(`✅ Thu ngân đã đặt thêm món vào Bàn ${selectedTable.table_number} (Đơn #${res.data.orderId}) & đồng bộ sang KDS!`);
            } else {
                alert(`✅ Đã tạo & đồng bộ Đơn #${res.data.orderId} sang Màn hình Pha chế KDS & Admin!`);
            }
        } catch (err) {
            alert(err.response?.data?.message || 'Lỗi tạo đơn / gọi thêm món');
        }
    };

    // Cập nhật trạng thái Giao hàng Ship (ready -> delivering)
    const handleUpdateDeliveryStatus = async (orderId, nextStatus) => {
        try {
            await axiosClient.patch(`/kds/orders/${orderId}/status`, { status: nextStatus });
            await loadPosData();
            const detailRes = await axiosClient.get(`/pos/orders/${orderId}`);
            setOrderDetails(detailRes.data);
        } catch (err) {
            alert(err.response?.data?.message || 'Lỗi cập nhật trạng thái giao hàng');
        }
    };

    const toggleFoodNoteTag = (tag) => {
        setItemNote((prev) => {
            if (prev.includes(tag)) {
                return prev.replace(tag, '').replace(/,\s*,/g, ',').replace(/^,\s*|,\s*$/g, '').trim();
            }
            return prev ? `${prev}, ${tag}` : tag;
        });
    };

    const drinkTotalCount = normalizedProducts.filter((p) => p.is_available && !p.is_food).length;
    const foodTotalCount = normalizedProducts.filter((p) => p.is_available && p.is_food).length;

    return (
        <div className="pos-layout-grid">
            {/* CỘT TRÁI: SƠ ĐỒ BÀN & DANH SÁCH ĐƠN ĐANG HOẠT ĐỘNG */}
            <div>
                <FloorTableMap
                    tables={tables}
                    selectedTable={selectedTable}
                    onSelectTable={handleSelectTable}
                />

                {selectedTable && (
                    <div
                        className="card-panel"
                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                    >
                        <div>
                            <strong>
                                {`🪑 Đang chọn: Bàn ${selectedTable.table_number} (${selectedTable.area_name || 'Khu vực chính'})`}
                            </strong>
                            <div style={{ fontSize: 13 }}>
                                <span>{`Trạng thái hiện tại: ${(selectedTable.status || '').toUpperCase()}`}</span>
                                {activeOrderOnSelectedTable && (
                                    <span style={{ marginLeft: 8, fontWeight: 700 }}>
                                        {`• Đang có Đơn #${activeOrderOnSelectedTable.id} (Có thể gọi thêm món ở khung bên phải)`}
                                    </span>
                                )}
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                            {selectedTable.status === 'empty' && (
                                <button
                                    type="button"
                                    className="btn-warning btn-sm"
                                    onClick={() => handleToggleReserveTable('reserved')}
                                >
                                    <span>📌 Đặt trước bàn này</span>
                                </button>
                            )}
                            {selectedTable.status === 'reserved' && (
                                <button
                                    type="button"
                                    className="btn-success btn-sm"
                                    onClick={() => handleToggleReserveTable('empty')}
                                >
                                    <span>🔓 Hủy đặt trước (Mở bàn trống)</span>
                                </button>
                            )}
                        </div>
                    </div>
                )}

                <div className="card-panel">
                    <div className="card-panel-header">
                        <div>
                            <h3>
                                {`🛵 Quản lý Đơn Đặt Ship (Delivery), Mang đi & Tại bàn (${activeOrders.length})`}
                            </h3>
                            <small>
                                <span>Bấm vào bất kỳ đơn nào để Gọi thêm món cho bàn đó, điều phối Ship hoặc Thanh toán</span>
                            </small>
                        </div>
                    </div>
                    <table className="modern-table">
                        <thead>
                            <tr>
                                <th>Mã</th>
                                <th>Phân loại / Bàn / Địa chỉ Ship</th>
                                <th>Trạng thái</th>
                                <th>Tổng tiền</th>
                                <th>Thao tác</th>
                            </tr>
                        </thead>
                        <tbody>
                            {activeOrders.map((ord) => (
                                <tr
                                    key={ord.id}
                                    style={{
                                        background: orderDetails?.order?.id === ord.id ? '#eff6ff' : 'transparent',
                                        cursor: 'pointer'
                                    }}
                                    onClick={() => handleSelectActiveOrder(ord)}
                                >
                                    <td>
                                        <b>{`#${ord.id}`}</b>
                                    </td>
                                    <td>
                                        {ord.order_type === 'dine_in' && (
                                            <span>{`🍽️ Bàn ${ord.table_number || ord.table_id}`}</span>
                                        )}
                                        {ord.order_type === 'take_away' && (
                                            <span>{`🛍️ Mang đi (${ord.customer_name || 'Khách lẻ'})`}</span>
                                        )}
                                        {ord.order_type === 'delivery' && (
                                            <div>
                                                <span className="badge badge-warning">🛵 ĐƠN SHIP</span>
                                                <b style={{ marginLeft: 6 }}>{`${ord.customer_name || 'Khách đặt Ship'}`}</b>
                                                <div style={{ fontSize: 12 }}>
                                                    <span>{`📍 Đ/c: ${ord.delivery_address || ''}`}</span>
                                                </div>
                                            </div>
                                        )}
                                    </td>
                                    <td>
                                        <span
                                            className={`badge ${
                                                ord.status === 'ready' || ord.status === 'delivering'
                                                    ? 'badge-success'
                                                    : 'badge-loyal'
                                            }`}
                                        >
                                            {`${(ord.status || '').toUpperCase()}`}
                                        </span>
                                    </td>
                                    <td style={{ fontWeight: 700 }}>
                                        <span>{`${Number(ord.final_amount || 0).toLocaleString('vi-VN')}đ`}</span>
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', gap: 6 }} onClick={(e) => e.stopPropagation()}>
                                            {ord.order_type === 'delivery' && ord.status !== 'delivering' && (
                                                <button
                                                    type="button"
                                                    className="btn-warning btn-sm"
                                                    onClick={() => handleUpdateDeliveryStatus(ord.id, 'delivering')}
                                                >
                                                    <span>🛵 Giao Ship</span>
                                                </button>
                                            )}
                                            <button
                                                type="button"
                                                className="btn-primary btn-sm"
                                                onClick={() => handleSelectActiveOrder(ord)}
                                            >
                                                <span>💳 Chọn / Gọi thêm</span>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <TableMergeTransferModal
                    tables={tables}
                    onTransfer={async (fromTableId, toTableId) => {
                        await axiosClient.post('/pos/transfer-table', { fromTableId, toTableId });
                        loadPosData();
                    }}
                    onMerge={async (sourceTableId, targetTableId) => {
                        await axiosClient.post('/pos/merge-tables', { sourceTableId, targetTableId });
                        loadPosData();
                    }}
                />
            </div>

            {/* CỘT PHẢI: QUẦY THU NGÂN ĐẶT MÓN / GỌI THÊM MÓN & THANH TOÁN */}
            <div>
                <div className="card-panel">
                    <div className="card-panel-header">
                        <h3>
                            {posOrderType === 'dine_in' && selectedTable
                                ? activeOrderOnSelectedTable
                                    ? `➕ Gọi Thêm Món Vào Bàn ${selectedTable.table_number} (Đơn #${activeOrderOnSelectedTable.id})`
                                    : `➕ Tạo Đơn Mới — Bàn ${selectedTable.table_number}`
                                : '➕ Thu Ngân Tạo Đơn / Gọi Thêm Món'}
                        </h3>
                        <span className="badge badge-standard">{`${posCartTotalCount} món`}</span>
                    </div>

                    <div className="order-type-tabs">
                        <button
                            type="button"
                            className={`order-type-tab ${posOrderType === 'dine_in' ? 'active' : ''}`}
                            onClick={() => setPosOrderType('dine_in')}
                        >
                            <span>
                                {`🍽️ Tại bàn / Gọi thêm ${selectedTable ? `(${selectedTable.table_number})` : ''}`}
                            </span>
                        </button>
                        <button
                            type="button"
                            className={`order-type-tab ${posOrderType === 'take_away' ? 'active' : ''}`}
                            onClick={() => setPosOrderType('take_away')}
                        >
                            <span>🛍️ Mang đi</span>
                        </button>
                        <button
                            type="button"
                            className={`order-type-tab ${posOrderType === 'delivery' ? 'active' : ''}`}
                            onClick={() => setPosOrderType('delivery')}
                        >
                            <span>🛵 Đơn Ship</span>
                        </button>
                    </div>

                    {posOrderType === 'dine_in' && (
                        <div style={{ marginBottom: 12 }}>
                            <select
                                value={selectedTable?.id || ''}
                                onChange={(e) => {
                                    const tbl = tables.find((t) => Number(t.id) === Number(e.target.value));
                                    handleSelectTable(tbl || null);
                                }}
                                style={{
                                    width: '100%',
                                    padding: '9px 12px',
                                    borderRadius: 8,
                                    border: activeOrderOnSelectedTable ? '2px solid #d97706' : '1px solid #cbd5e1',
                                    background: activeOrderOnSelectedTable ? '#fffbeb' : '#ffffff',
                                    fontWeight: 600
                                }}
                            >
                                <option value="">-- Chọn nhanh Bàn khách báo (Mở bàn mới hoặc Đặt thêm món) --</option>
                                {tables.map((t) => {
                                    const isOccupied = t.status === 'occupied';
                                    return (
                                        <option key={t.id} value={t.id}>
                                            {`🪑 Bàn ${t.table_number} (${t.area_name || 'Khu chính'}) — ${
                                                isOccupied
                                                    ? '🔥 ĐANG CÓ KHÁCH (Chọn để Đặt thêm món)'
                                                    : t.status === 'reserved'
                                                    ? '📌 Đã đặt trước'
                                                    : '🟢 Bàn trống (Mở đơn mới)'
                                            }`}
                                        </option>
                                    );
                                })}
                            </select>
                        </div>
                    )}

                    {posOrderType === 'delivery' && (
                        <input
                            style={{ marginBottom: 12 }}
                            placeholder="Nhập địa chỉ & SĐT khách đặt Ship..."
                            value={posDeliveryAddress}
                            onChange={(e) => setPosDeliveryAddress(e.target.value)}
                        />
                    )}

                    {/* BỘ LỌC PHÂN LOẠI ĐỒ ĂN (CÁI) & THỨC UỐNG (LY) */}
                    <div
                        style={{
                            display: 'flex',
                            gap: 6,
                            flexWrap: 'wrap',
                            marginBottom: 10,
                            alignItems: 'center',
                            justifyContent: 'space-between'
                        }}
                    >
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            <button
                                type="button"
                                onClick={() => {
                                    setItemGroupFilter('ALL');
                                    setSelectedCategoryId('ALL');
                                }}
                                className={itemGroupFilter === 'ALL' ? 'btn-primary btn-sm' : 'btn-outline btn-sm'}
                            >
                                <span>{`Tất cả (${drinkTotalCount + foodTotalCount})`}</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setItemGroupFilter('DRINK');
                                    setSelectedCategoryId('ALL');
                                }}
                                className={itemGroupFilter === 'DRINK' ? 'btn-primary btn-sm' : 'btn-outline btn-sm'}
                            >
                                <span>{`🥤 Thức uống (${drinkTotalCount})`}</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setItemGroupFilter('FOOD');
                                    setSelectedCategoryId('ALL');
                                }}
                                className={itemGroupFilter === 'FOOD' ? 'btn-warning btn-sm' : 'btn-outline btn-sm'}
                            >
                                <span>{`🥐 Bánh & Đồ ăn (${foodTotalCount})`}</span>
                            </button>
                        </div>
                        <input
                            type="text"
                            placeholder="🔍 Tìm tên món..."
                            value={searchKeyword}
                            onChange={(e) => setSearchKeyword(e.target.value)}
                            style={{
                                padding: '6px 10px',
                                borderRadius: 8,
                                border: '1px solid #cbd5e1',
                                fontSize: 12,
                                maxWidth: 180
                            }}
                        />
                    </div>

                    {/* Lọc nhanh theo danh mục con đã tách riêng */}
                    {visibleCategoriesForPos.length > 0 && (
                        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 8, marginBottom: 8 }}>
                            <button
                                type="button"
                                onClick={() => setSelectedCategoryId('ALL')}
                                className={selectedCategoryId === 'ALL' ? 'btn-primary btn-sm' : 'btn-outline btn-sm'}
                            >
                                <span>Tất cả danh mục</span>
                            </button>
                            {visibleCategoriesForPos.map((cat) => (
                                <button
                                    key={cat.id}
                                    type="button"
                                    onClick={() => setSelectedCategoryId(cat.id)}
                                    className={Number(selectedCategoryId) === Number(cat.id) ? 'btn-primary btn-sm' : 'btn-outline btn-sm'}
                                >
                                    <span>{`${cat.category_type === 'food' ? '🥐' : '🥤'} ${cat.name}`}</span>
                                </button>
                            ))}
                        </div>
                    )}

                    {/* DANH SÁCH MÓN */}
                    <div className="pos-quick-menu">
                        {filteredMenuProducts.map((p) => (
                            <button
                                type="button"
                                key={p.id}
                                className="pos-item-btn"
                                onClick={() => handleOpenCustomizeModal(p)}
                                style={{
                                    border: p.is_food ? '1.5px solid #fbbf24' : '1.5px solid #93c5fd',
                                    background: p.is_food ? '#fffbeb' : '#f8fafc',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'flex-start',
                                    justifyContent: 'space-between',
                                    textAlign: 'left',
                                    padding: 10
                                }}
                            >
                                <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                    <span className={`badge ${p.is_food ? 'badge-warning' : 'badge-loyal'}`} style={{ fontSize: 10 }}>
                                        <span>{p.is_food ? '🥐 Đồ ăn' : '🥤 Thức uống'}</span>
                                    </span>
                                    <span style={{ fontSize: 11 }}>
                                        <span>{`Đã bán ${p.sold_count_num} ${p.unit_label}`}</span>
                                    </span>
                                </div>
                                <strong style={{ fontSize: 13, marginBottom: 4, display: 'block' }}>
                                    {`${p.name}`}
                                </strong>
                                <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: 12, fontWeight: 700 }}>
                                        {`${Number(p.base_price || 0).toLocaleString('vi-VN')}đ / ${p.unit_label}`}
                                    </span>
                                    <span style={{ fontSize: 11, fontWeight: 700 }}>+ Chọn</span>
                                </div>
                            </button>
                        ))}
                    </div>

                    {/* GIỎ MÓN TẠM THỜI CỦA THU NGÂN */}
                    {posCart.length > 0 && (
                        <div style={{ marginTop: 12, marginBottom: 12, padding: 12, background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>
                                <span>Danh sách món chuẩn bị gửi Bếp / Pha chế:</span>
                            </div>
                            {posCart.map((c) => (
                                <div
                                    key={c.cartKey}
                                    style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        fontSize: 13,
                                        padding: '6px 0',
                                        borderBottom: '1px dashed #e2e8f0'
                                    }}
                                >
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: 700 }}>
                                            <span>{`${c.name} (${c.quantity} ${c.unit_label})`}</span>
                                        </div>
                                        <div style={{ fontSize: 11 }}>
                                            <span>
                                                {c.is_food
                                                    ? `Đồ ăn (${c.unit_label})${c.custom_options?.note ? ` • Ghi chú: ${c.custom_options.note}` : ' • Không áp dụng đường/đá'}`
                                                    : `${c.custom_options?.sugar || '100% đường'} • ${c.custom_options?.ice || '100% đá'}${
                                                          c.custom_options?.note ? ` • ${c.custom_options.note}` : ''
                                                      }`}
                                            </span>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <button
                                            type="button"
                                            className="btn-outline btn-sm"
                                            onClick={() => handleUpdateCartQty(c.cartKey, -1)}
                                        >
                                            <span>-</span>
                                        </button>
                                        <strong style={{ minWidth: 36, textAlign: 'center', fontSize: 12 }}>
                                            {`${c.quantity} ${c.unit_label}`}
                                        </strong>
                                        <button
                                            type="button"
                                            className="btn-outline btn-sm"
                                            onClick={() => handleUpdateCartQty(c.cartKey, 1)}
                                        >
                                            <span>+</span>
                                        </button>
                                        <b style={{ minWidth: 70, textAlign: 'right' }}>
                                            {`${(Number(c.unit_price) * Number(c.quantity)).toLocaleString('vi-VN')}đ`}
                                        </b>
                                        <button
                                            type="button"
                                            className="btn-danger btn-sm"
                                            onClick={() => handleRemoveCartItem(c.cartKey)}
                                        >
                                            <span>✕</span>
                                        </button>
                                    </div>
                                </div>
                            ))}
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, fontWeight: 700, fontSize: 14 }}>
                                <span>Tổng cộng phiếu gọi thêm:</span>
                                <span>{`${posCartTotalAmount.toLocaleString('vi-VN')}đ`}</span>
                            </div>
                        </div>
                    )}

                    <button
                        type="button"
                        className={posOrderType === 'dine_in' && activeOrderOnSelectedTable ? 'btn-warning w-full' : 'btn-primary w-full'}
                        onClick={createPosOrder}
                    >
                        <span>
                            {posOrderType === 'dine_in' && activeOrderOnSelectedTable
                                ? `🚀 Đặt Thêm Món Vào Bàn ${selectedTable.table_number} (Cộng vào Đơn #${activeOrderOnSelectedTable.id})`
                                : '🚀 Xác nhận Tạo Đơn / Cộng Dồn Món Vào Bàn'}
                        </span>
                    </button>
                </div>

                <PaymentCheckoutModal
                    orderDetails={orderDetails}
                    onPay={async (orderId, payment_method, voucher_code) => {
                        try {
                            await axiosClient.post(`/pos/orders/${orderId}/pay`, { payment_method, voucher_code });
                            alert(`✅ Đã thanh toán Đơn #${orderId} thành công & Đồng bộ sang Admin!`);
                            setOrderDetails(null);
                            setSelectedTable(null);
                            loadPosData();
                        } catch (err) {
                            alert(err.response?.data?.message || 'Lỗi thanh toán');
                        }
                    }}
                />

                <BillSplitModal
                    orderDetails={orderDetails}
                    tables={tables}
                    onSplit={async (sourceOrderId, targetTableId, itemIdsToMove) => {
                        await axiosClient.post('/pos/split-order', { sourceOrderId, targetTableId, itemIdsToMove });
                        loadPosData();
                    }}
                />

                <ThermalReceiptPrint orderDetails={orderDetails} />
            </div>

            {/* MODAL TÙY CHỌN MÓN DÀNH CHO THU NGÂN */}
            {customizingProduct && (
                <div className="modal-backdrop" onClick={() => setCustomizingProduct(null)}>
                    <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                            <div>
                                <span className={`badge ${customizingProduct.is_food ? 'badge-warning' : 'badge-loyal'}`} style={{ marginBottom: 4 }}>
                                    <span>{customizingProduct.is_food ? '🥐 Đồ ăn (Tính theo cái)' : '🥤 Thức uống (Tính theo ly)'}</span>
                                </span>
                                <h3 style={{ margin: 0, fontSize: 18 }}>{`${customizingProduct.name}`}</h3>
                                <small>
                                    <span>{`Đã bán ${customizingProduct.sold_count_num} ${customizingProduct.unit_label} • Đơn giá: ${Number(customizingProduct.base_price || 0).toLocaleString('vi-VN')}đ/${customizingProduct.unit_label}`}</span>
                                </small>
                            </div>
                            <button type="button" className="btn-outline btn-sm" onClick={() => setCustomizingProduct(null)}>
                                <span>✕</span>
                            </button>
                        </div>

                        <div
                            style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '10px 12px',
                                background: '#f8fafc',
                                borderRadius: 10,
                                marginBottom: 14,
                                border: '1px solid #cbd5e1'
                            }}
                        >
                            <strong style={{ fontSize: 14 }}>{`Số lượng (${customizingProduct.unit_label}):`}</strong>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <button
                                    type="button"
                                    className="btn-outline btn-sm"
                                    onClick={() => setItemQty((q) => Math.max(1, q - 1))}
                                >
                                    <span>-</span>
                                </button>
                                <strong style={{ minWidth: 55, textAlign: 'center' }}>
                                    {`${itemQty} ${customizingProduct.unit_label}`}
                                </strong>
                                <button
                                    type="button"
                                    className="btn-outline btn-sm"
                                    onClick={() => setItemQty((q) => q + 1)}
                                >
                                    <span>+</span>
                                </button>
                            </div>
                        </div>

                        {!customizingProduct.is_food ? (
                            <>
                                <div style={{ marginBottom: 12 }}>
                                    <label>Chọn lượng đường:</label>
                                    <div className="option-pill-group">
                                        {SUGAR_LEVELS.map((s) => (
                                            <button
                                                key={s}
                                                type="button"
                                                className={`option-pill ${selectedSugar === s ? 'active' : ''}`}
                                                onClick={() => setSelectedSugar(s)}
                                            >
                                                <span>{`${s}`}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div style={{ marginBottom: 12 }}>
                                    <label>Chọn lượng đá:</label>
                                    <div className="option-pill-group">
                                        {ICE_LEVELS.map((ice) => (
                                            <button
                                                key={ice}
                                                type="button"
                                                className={`option-pill ${selectedIce === ice ? 'active' : ''}`}
                                                onClick={() => setSelectedIce(ice)}
                                            >
                                                <span>{`${ice}`}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div style={{ marginBottom: 12 }}>
                                <label>Tùy chọn phục vụ đồ ăn (Không có đường & đá):</label>
                                <div className="option-pill-group">
                                    {FOOD_QUICK_NOTES.map((tag) => {
                                        const active = itemNote.includes(tag);
                                        return (
                                            <button
                                                key={tag}
                                                type="button"
                                                className={`option-pill ${active ? 'active' : ''}`}
                                                onClick={() => toggleFoodNoteTag(tag)}
                                            >
                                                <span>{`+ ${tag}`}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        <div style={{ marginBottom: 16 }}>
                            <label>Ghi chú cho Bếp / Pha chế:</label>
                            <input
                                type="text"
                                value={itemNote}
                                onChange={(e) => setItemNote(e.target.value)}
                                placeholder={
                                    customizingProduct.is_food
                                        ? 'VD: Hâm nóng giòn, mang ra ngay...'
                                        : 'VD: Ít sữa, bỏ ly mang về...'
                                }
                            />
                        </div>

                        <div style={{ display: 'flex', gap: 10 }}>
                            <button
                                type="button"
                                className="btn-outline"
                                style={{ flex: 1 }}
                                onClick={() => setCustomizingProduct(null)}
                            >
                                <span>Hủy</span>
                            </button>
                            <button
                                type="button"
                                className="btn-success"
                                style={{ flex: 2 }}
                                onClick={handleConfirmAddItemToPosCart}
                            >
                                <span>
                                    {`Thêm ${itemQty} ${customizingProduct.unit_label} (${(
                                        Number(customizingProduct.base_price || 0) * itemQty
                                    ).toLocaleString('vi-VN')}đ)`}
                                </span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}