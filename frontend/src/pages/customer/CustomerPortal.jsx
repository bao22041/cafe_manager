// frontend/src/pages/customer/CustomerPortal.jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axiosClient from '../../api/axiosClient';
import { useSocket } from '../../context/SocketContext';
import ProductFilterBar from '../../components/customer/ProductFilterBar';
import ProductOptionModal, { isFoodProduct } from '../../components/customer/ProductOptionModal';
import CartDrawer from '../../components/customer/CartDrawer';
import LiveOrderStepTracker from '../../components/customer/LiveOrderStepTracker';
import ReviewRatingModal from '../../components/customer/ReviewRatingModal';

// Export lại isFoodProduct để mọi file khác nếu import từ CustomerPortal đều hoạt động bình thường
export { isFoodProduct };

// Hỗ trợ hiển thị ảnh tải lên từ máy (data:image/...), đường dẫn /uploads/... và link http/https
export const getProductImage = (product) => {
    if (!product) return 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=600&q=80';
    const rawUrl = (product.image_url || product.image || '').trim();
    if (
        rawUrl.startsWith('http://') ||
        rawUrl.startsWith('https://') ||
        rawUrl.startsWith('data:image/') ||
        rawUrl.startsWith('/uploads/') ||
        rawUrl.startsWith('blob:')
    ) {
        return rawUrl;
    }

    const name = (product.name || '').toLowerCase();
    if (name.includes('bạc xỉu') || name.includes('muối')) return 'https://images.unsplash.com/photo-1517701604599-bb29b565090c?auto=format&fit=crop&w=600&q=80';
    if (name.includes('cà phê') || name.includes('espresso')) return 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=600&q=80';
    if (name.includes('trà sữa') || name.includes('ô long')) return 'https://images.unsplash.com/photo-1558857563-b371033873b8?auto=format&fit=crop&w=600&q=80';
    if (name.includes('đào') || name.includes('trà')) return 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?auto=format&fit=crop&w=600&q=80';
    if (name.includes('tiramisu') || name.includes('mousse') || name.includes('bánh')) return 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&w=600&q=80';
    return 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=600&q=80';
};

export default function CustomerPortal() {
    const socket = useSocket();
    const [catalog, setCatalog] = useState({ categories: [], products: [], options: [], tables: [], vouchers: [] });
    const [filters, setFilters] = useState({ category_id: '', search: '', sort_by: '', max_price: '' });
    const [itemGroupTab, setItemGroupTab] = useState('ALL'); // 'ALL' | 'DRINK' | 'FOOD'
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [cart, setCart] = useState([]);
    const [orderMeta, setOrderMeta] = useState({ order_type: 'dine_in', table_id: '', voucher_code: '', delivery_address: '' });
    const [activeOrder, setActiveOrder] = useState(null);
    const [isReviewOpen, setIsReviewOpen] = useState(false);

    const getDismissedOrders = useCallback(() => {
        try {
            return JSON.parse(localStorage.getItem('dismissed_cafe_orders') || '[]');
        } catch {
            return [];
        }
    }, []);

    const markOrderDismissed = useCallback((orderId) => {
        if (!orderId) return;
        const currentList = getDismissedOrders();
        if (!currentList.includes(Number(orderId))) {
            localStorage.setItem('dismissed_cafe_orders', JSON.stringify([...currentList, Number(orderId)]));
        }
        setActiveOrder(null);
        setIsReviewOpen(false);
    }, [getDismissedOrders]);

    const fetchCatalog = useCallback(async () => {
        try {
            const res = await axiosClient.get('/customer/catalog', { params: filters });
            setCatalog(res.data || { categories: [], products: [], options: [], tables: [], vouchers: [] });
        } catch (err) {
            console.error('Lỗi tải catalog:', err);
        }
    }, [filters]);

    const fetchLatestCustomerOrder = useCallback(async () => {
        try {
            const res = await axiosClient.get('/auth/profile');
            const orders = res.data?.orders || [];
            if (orders.length === 0) {
                setActiveOrder(null);
                return;
            }

            const dismissed = getDismissedOrders();

            const targetOrder = orders.find((ord) => {
                if (ord.status === 'cancelled') return false;
                if (dismissed.includes(Number(ord.id))) return false;

                const isInProgress =
                    ['pending', 'preparing', 'ready', 'delivering'].includes(ord.status) &&
                    ord.payment_status === 'unpaid';

                const hasUnreviewedItems = (ord.items || []).some((it) => !it.is_reviewed);
                return isInProgress || hasUnreviewedItems;
            });

            if (targetOrder) {
                setActiveOrder({ ...targetOrder, orderId: targetOrder.id });
            } else {
                setActiveOrder(null);
                setIsReviewOpen(false);
            }
        } catch (err) {}
    }, [getDismissedOrders]);

    useEffect(() => {
        fetchCatalog();
        fetchLatestCustomerOrder();
    }, [fetchCatalog, fetchLatestCustomerOrder]);

    useEffect(() => {
        if (!socket) return;
        if (activeOrder?.orderId) {
            socket.emit('TRACK_ORDER', activeOrder.orderId);
        }
        const handleSync = () => {
            fetchCatalog();
            fetchLatestCustomerOrder();
        };
        socket.on('GLOBAL_SYNC', handleSync);
        socket.on('ORDER_STATUS_UPDATED', handleSync);
        return () => {
            socket.off('GLOBAL_SYNC', handleSync);
            socket.off('ORDER_STATUS_UPDATED', handleSync);
        };
    }, [socket, activeOrder?.orderId, fetchCatalog, fetchLatestCustomerOrder]);

    const enrichedProducts = useMemo(() => {
        return (catalog.products || []).map((p) => {
            const isFood = isFoodProduct(p);
            return {
                ...p,
                is_food: isFood,
                unit_label: isFood ? 'cái' : 'ly'
            };
        });
    }, [catalog.products]);

    const displayedProducts = useMemo(() => {
        return enrichedProducts.filter((p) => {
            if (itemGroupTab === 'DRINK') return !p.is_food;
            if (itemGroupTab === 'FOOD') return p.is_food;
            return true;
        });
    }, [enrichedProducts, itemGroupTab]);

    const handleReserveTable = async (tableId) => {
        try {
            const res = await axiosClient.patch(`/pos/tables/${tableId}/status`, { status: 'reserved' });
            alert(res.data.message);
            fetchCatalog();
        } catch (err) {
            alert(err.response?.data?.message || 'Không thể đặt trước bàn này');
        }
    };

    const handleCheckout = async () => {
        if (cart.length === 0) return alert('Vui lòng chọn ít nhất 1 món vào giỏ hàng!');
        if (orderMeta.order_type === 'dine_in' && !orderMeta.table_id) {
            return alert('Vui lòng chọn số bàn phục vụ tại quán!');
        }
        if (orderMeta.order_type === 'delivery' && !orderMeta.delivery_address.trim()) {
            return alert('Vui lòng nhập địa chỉ nhận hàng cho đơn Ship!');
        }
        try {
            await axiosClient.post('/orders', { ...orderMeta, items: cart });
            setCart([]);
            setOrderMeta((prev) => ({ ...prev, voucher_code: '' }));
            await fetchCatalog();
            await fetchLatestCustomerOrder();
            alert('Đặt món thành công! Đơn hàng đã được đồng bộ sang Quầy Pha Chế & Thu Ngân.');
        } catch (err) {
            alert(err.response?.data?.message || 'Lỗi đặt món');
        }
    };

    const handleReviewSubmit = async (reviewData) => {
        if (!activeOrder) return;
        try {
            await axiosClient.post('/customer/reviews', {
                ...reviewData,
                order_id: activeOrder.orderId
            });

            const updatedItems = (activeOrder.items || []).map((item) =>
                Number(item.product_id) === Number(reviewData.product_id)
                    ? { ...item, is_reviewed: true }
                    : item
            );

            const hasRemainingUnreviewed = updatedItems.some((item) => !item.is_reviewed);

            if (!hasRemainingUnreviewed) {
                setIsReviewOpen(false);
                if (activeOrder.status === 'completed' || activeOrder.payment_status === 'paid') {
                    markOrderDismissed(activeOrder.orderId);
                } else {
                    setActiveOrder((prev) => (prev ? { ...prev, items: updatedItems } : null));
                }
                alert('Cảm ơn bạn đã hoàn tất đánh giá cho đơn hàng!');
            } else {
                setActiveOrder((prev) => (prev ? { ...prev, items: updatedItems } : null));
                alert('Đã lưu đánh giá món! Bạn có thể tiếp tục đánh giá món còn lại trong đơn.');
            }

            fetchCatalog();
        } catch (err) {
            alert(err.response?.data?.message || 'Món này đã được đánh giá trước đó!');
            fetchLatestCustomerOrder();
        }
    };

    const emptyTableCount = (catalog.tables || []).filter((t) => t.status === 'empty').length;
    const drinkCount = enrichedProducts.filter((p) => !p.is_food).length;
    const foodCount = enrichedProducts.filter((p) => p.is_food).length;

    return (
        <div>
            <div className="customer-banner">
                <div>
                    <span className="badge badge-vip" style={{ marginBottom: 8 }}>ĐỒNG BỘ TRỰC TIẾP 4 PHÂN HỆ</span>
                    <h2 style={{ fontSize: 26, marginBottom: 4 }}>Thưởng thức Cà phê Đặc sản & Bánh Ngọt</h2>
                    <p style={{ fontSize: 14 }}>
                        <span>Bấm chọn trực tiếp Voucher giảm giá trong Giỏ hàng • Hỗ trợ Đặt trước bàn, Gọi thêm món tại bàn & Đặt Ship tận nơi</span>
                    </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 13 }}>Bàn trống sẵn sàng</div>
                    <strong style={{ fontSize: 28 }}>{`${emptyTableCount} Bàn`}</strong>
                </div>
            </div>

            <LiveOrderStepTracker
                activeOrder={activeOrder}
                onOpenReview={() => setIsReviewOpen(true)}
                onDismissOrder={markOrderDismissed}
            />

            {/* Bộ lọc nhanh: Tất cả / Thức uống (ly) / Đồ ăn & Bánh (cái) */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
                <button
                    type="button"
                    onClick={() => {
                        setItemGroupTab('ALL');
                        setFilters((prev) => ({ ...prev, category_id: '' }));
                    }}
                    style={{
                        padding: '8px 16px',
                        borderRadius: 999,
                        border: itemGroupTab === 'ALL' ? '2px solid #000000' : '1px solid #cbd5e1',
                        background: itemGroupTab === 'ALL' ? '#e6ccb2' : '#ffffff',
                        color: '#000000',
                        fontWeight: 700,
                        cursor: 'pointer'
                    }}
                >
                    <span>{`Tất cả (${enrichedProducts.length})`}</span>
                </button>
                <button
                    type="button"
                    onClick={() => {
                        setItemGroupTab('DRINK');
                        setFilters((prev) => ({ ...prev, category_id: '' }));
                    }}
                    style={{
                        padding: '8px 16px',
                        borderRadius: 999,
                        border: itemGroupTab === 'DRINK' ? '2px solid #000000' : '1px solid #cbd5e1',
                        background: itemGroupTab === 'DRINK' ? '#dbeafe' : '#ffffff',
                        color: '#000000',
                        fontWeight: 700,
                        cursor: 'pointer'
                    }}
                >
                    <span>{`🥤 Thức uống (${drinkCount})`}</span>
                </button>
                <button
                    type="button"
                    onClick={() => {
                        setItemGroupTab('FOOD');
                        setFilters((prev) => ({ ...prev, category_id: '' }));
                    }}
                    style={{
                        padding: '8px 16px',
                        borderRadius: 999,
                        border: itemGroupTab === 'FOOD' ? '2px solid #000000' : '1px solid #cbd5e1',
                        background: itemGroupTab === 'FOOD' ? '#fde68a' : '#ffffff',
                        color: '#000000',
                        fontWeight: 700,
                        cursor: 'pointer'
                    }}
                >
                    <span>{`🥐 Đồ ăn & Bánh (${foodCount})`}</span>
                </button>
            </div>

            <ProductFilterBar
                categories={catalog.categories}
                filters={filters}
                setFilters={setFilters}
                itemGroupTab={itemGroupTab}
            />

            <div className="customer-workspace">
                <div className="product-grid">
                    {displayedProducts.map((p) => (
                        <div key={p.id} className="product-card">
                            <div className="product-thumb">
                                <img src={getProductImage(p)} alt={p.name} />
                                <div className="product-badges-top">
                                    <span className="badge badge-warning">{`★ ${p.avg_rating || 5.0}`}</span>
                                    <span className="badge badge-standard">{`${p.calories || 150} kcal`}</span>
                                    <span
                                        className="badge"
                                        style={{
                                            background: p.is_food ? '#fef3c7' : '#e0f2fe',
                                            color: '#000000',
                                            fontWeight: 700
                                        }}
                                    >
                                        <span>{p.is_food ? '🥐 Đồ ăn' : '🥤 Thức uống'}</span>
                                    </span>
                                </div>
                            </div>
                            <div className="product-body">
                                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>
                                    <span>{`${p.category_name || (p.is_food ? 'Đồ ăn' : 'Thức uống')}`}</span>
                                </div>
                                <div className="product-title">
                                    <span>{`${p.name}`}</span>
                                </div>
                                <div className="product-desc">
                                    <span>{`${(p.description || '').replace(/^\[Đồ ăn\]\s*/i, '')}`}</span>
                                </div>
                                <div className="product-footer">
                                    <div>
                                        <div className="product-price">
                                            <span>{`${Number(p.base_price || 0).toLocaleString('vi-VN')}đ`}</span>
                                        </div>
                                        <small style={{ fontSize: 11 }}>
                                            <span>{`Đã bán ${Number(p.sold_count || 0)} ${p.unit_label}`}</span>
                                        </small>
                                    </div>
                                    {p.is_available ? (
                                        <button type="button" onClick={() => setSelectedProduct(p)}>
                                            <span>+ Chọn món</span>
                                        </button>
                                    ) : (
                                        <span className="badge badge-danger">Tạm hết</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                <CartDrawer
                    cart={cart}
                    setCart={setCart}
                    tables={catalog.tables}
                    vouchers={catalog.vouchers || []}
                    orderMeta={orderMeta}
                    setOrderMeta={setOrderMeta}
                    onCheckout={handleCheckout}
                    onReserveTable={handleReserveTable}
                />
            </div>

            <ProductOptionModal
                product={selectedProduct}
                onClose={() => setSelectedProduct(null)}
                onAddToCart={(item) => setCart([...cart, item])}
            />

            <ReviewRatingModal
                isOpen={isReviewOpen}
                items={activeOrder?.items || []}
                onClose={() => setIsReviewOpen(false)}
                onSubmitReview={handleReviewSubmit}
            />
        </div>
    );
}