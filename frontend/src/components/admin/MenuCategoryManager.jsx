// frontend/src/components/admin/MenuCategoryManager.jsx
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { isFoodProduct, isFoodCategory } from '../customer/ProductOptionModal';
import { getProductImage } from '../../pages/customer/CustomerPortal';

const QUICK_SAMPLE_IMAGES = [
    { label: '☕ Cafe Sữa', type: 'drink', url: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=600&q=80' },
    { label: '🥛 Bạc Xỉu', type: 'drink', url: 'https://images.unsplash.com/photo-1517701604599-bb29b565090c?auto=format&fit=crop&w=600&q=80' },
    { label: '🧋 Trà Sữa', type: 'drink', url: 'https://images.unsplash.com/photo-1558857563-b371033873b8?auto=format&fit=crop&w=600&q=80' },
    { label: '🍑 Trà Trái Cây', type: 'drink', url: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?auto=format&fit=crop&w=600&q=80' },
    { label: '🥐 Bánh Croissant', type: 'food', url: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&w=600&q=80' },
    { label: '🍰 Bánh Tiramisu', type: 'food', url: 'https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?auto=format&fit=crop&w=600&q=80' }
];

export default function MenuCategoryManager({
    categories = [],
    products = [],
    onSaveCategory,
    onDeleteCategory,
    onSaveProduct,
    onDeleteProduct
}) {
    const [catForm, setCatForm] = useState({ id: '', name: '', category_type: 'drink', is_visible: true });
    const [adminFilterTab, setAdminFilterTab] = useState('ALL');
    const fileInputRef = useRef(null);
    const [uploadingImage, setUploadingImage] = useState(false);

    const [form, setForm] = useState({
        id: '',
        category_id: '',
        name: '',
        description: '',
        base_price: '',
        calories: 150,
        image_url: QUICK_SAMPLE_IMAGES[0].url,
        item_type: 'drink',
        is_available: true,
        is_visible: true
    });

    const drinkCategories = useMemo(
        () => categories.filter((c) => !isFoodCategory(c)),
        [categories]
    );
    const foodCategories = useMemo(
        () => categories.filter((c) => isFoodCategory(c)),
        [categories]
    );

    const matchingCategoriesForForm = useMemo(() => {
        const list = form.item_type === 'food' ? foodCategories : drinkCategories;
        return list.length > 0 ? list : categories;
    }, [form.item_type, foodCategories, drinkCategories, categories]);

    useEffect(() => {
        if (matchingCategoriesForForm.length > 0) {
            const existsInGroup = matchingCategoriesForForm.some(
                (c) => Number(c.id) === Number(form.category_id)
            );
            if (!existsInGroup) {
                setForm((prev) => ({
                    ...prev,
                    category_id: matchingCategoriesForForm[0].id
                }));
            }
        }
    }, [form.item_type, matchingCategoriesForForm, form.category_id]);

    const handleFileUpload = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            alert('Vui lòng chọn file định dạng hình ảnh (JPG, PNG, WEBP)!');
            return;
        }
        setUploadingImage(true);
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 550;
                const scale = img.width > MAX_WIDTH ? MAX_WIDTH / img.width : 1;
                canvas.width = Math.round(img.width * scale);
                canvas.height = Math.round(img.height * scale);
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.82);
                setForm((prev) => ({ ...prev, image_url: compressedDataUrl }));
                setUploadingImage(false);
            };
            img.onerror = () => {
                setUploadingImage(false);
                alert('Không thể đọc file ảnh này!');
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    };

    const resetForm = () => {
        const defaultDrinkCatId = drinkCategories[0]?.id || categories[0]?.id || 1;
        setForm({
            id: '',
            category_id: defaultDrinkCatId,
            name: '',
            description: '',
            base_price: '',
            calories: 150,
            image_url: QUICK_SAMPLE_IMAGES[0].url,
            item_type: 'drink',
            is_available: true,
            is_visible: true
        });
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleCategorySubmit = async (e) => {
        e.preventDefault();
        try {
            await onSaveCategory(catForm);
            setCatForm({ id: '', name: '', category_type: 'drink', is_visible: true });
        } catch (err) {
            alert(err.response?.data?.message || 'Lỗi lưu danh mục!');
        }
    };

    const handleProductSubmit = async (e) => {
        e.preventDefault();
        if (!form.image_url || !form.image_url.trim()) {
            return alert('Vui lòng chọn hoặc tải lên hình ảnh cho món!');
        }

        const isFoodSelected = form.item_type === 'food';
        let finalDescription = (form.description || '').trim();
        if (isFoodSelected && !isFoodProduct({ name: form.name, description: finalDescription, item_type: 'food' })) {
            finalDescription = finalDescription ? `[Đồ ăn] ${finalDescription}` : '[Đồ ăn] Phục vụ theo cái';
        } else if (!isFoodSelected) {
            finalDescription = finalDescription.replace(/^\[Đồ ăn\]\s*/gi, '').trim();
        }

        try {
            await onSaveProduct({
                ...form,
                category_id: Number(form.category_id) || matchingCategoriesForForm[0]?.id || 1,
                base_price: Number(form.base_price) || 0,
                calories: Number(form.calories) || 150,
                description: finalDescription,
                image_url: form.image_url.trim(),
                item_type: isFoodSelected ? 'food' : 'drink',
                is_food: isFoodSelected,
                is_available: Boolean(form.is_available),
                is_visible: Boolean(form.is_visible)
            });
            alert(form.id ? '✅ Đã cập nhật món & phân loại danh mục thành công!' : '✅ Đã thêm món mới vào đúng danh mục!');
            resetForm();
        } catch (err) {
            alert(err.response?.data?.message || 'Lỗi khi lưu sản phẩm vào Database!');
        }
    };

    const handleEditClick = (p) => {
        const foodDetected = isFoodProduct(p);
        setForm({
            id: p.id,
            category_id: p.category_id,
            name: p.name || '',
            description: (p.description || '').replace(/^\[Đồ ăn\]\s*/i, ''),
            base_price: p.base_price || '',
            calories: p.calories || 150,
            image_url: getProductImage(p),
            item_type: foodDetected ? 'food' : 'drink',
            is_available: p.is_available !== undefined ? Boolean(p.is_available) : true,
            is_visible: p.is_visible !== undefined ? Boolean(p.is_visible) : true
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const filteredAdminProducts = useMemo(() => {
        return products.filter((p) => {
            const isFood = isFoodProduct(p);
            if (adminFilterTab === 'DRINK') return !isFood;
            if (adminFilterTab === 'FOOD') return isFood;
            return true;
        });
    }, [products, adminFilterTab]);

    return (
        <div>
            <div className="card-panel">
                <div className="card-panel-header">
                    <div>
                        <h3>📂 Quản lý Danh mục Thực đơn (Tách biệt Thức uống & Bánh ngọt)</h3>
                        <small>Mỗi danh mục được gắn loại riêng (Thức uống hoặc Bánh ngọt/Đồ ăn) để không bao giờ bị lẫn lộn</small>
                    </div>
                </div>

                <form
                    onSubmit={handleCategorySubmit}
                    style={{ display: 'grid', gridTemplateColumns: '1fr 260px auto auto', gap: 12, marginBottom: 16 }}
                >
                    <input
                        placeholder="Nhập tên danh mục (VD: Trà trái cây, Cà phê Việt Nam, Bánh ngọt & Đồ ăn nhẹ)..."
                        value={catForm.name}
                        onChange={(e) => setCatForm({ ...catForm, name: e.target.value })}
                        required
                    />
                    <select
                        value={catForm.category_type}
                        onChange={(e) => setCatForm({ ...catForm, category_type: e.target.value })}
                    >
                        <option value="drink">🥤 Nhóm Danh mục Thức uống (Ly)</option>
                        <option value="food">🥐 Nhóm Danh mục Bánh ngọt & Đồ ăn (Cái)</option>
                    </select>
                    <button type="submit" className="btn-primary">
                        {catForm.id ? '💾 Lưu Danh mục' : '+ Thêm Danh mục'}
                    </button>
                    {catForm.id && (
                        <button
                            type="button"
                            className="btn-outline"
                            onClick={() => setCatForm({ id: '', name: '', category_type: 'drink', is_visible: true })}
                        >
                            Hủy
                        </button>
                    )}
                </form>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <div style={{ background: '#f8fafc', padding: 12, borderRadius: 10, border: '1.5px solid #93c5fd' }}>
                        <strong style={{ display: 'block', marginBottom: 8 }}>
                            🥤 Danh mục Thức uống ({drinkCategories.length})
                        </strong>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                            {drinkCategories.map((c) => (
                                <span
                                    key={c.id}
                                    className="badge badge-loyal"
                                    style={{ padding: '6px 12px', display: 'inline-flex', alignItems: 'center', gap: 8 }}
                                >
                                    <span>☕ {c.name}</span>
                                    <button
                                        type="button"
                                        className="btn-outline btn-sm"
                                        style={{ padding: '2px 6px', fontSize: 10 }}
                                        onClick={() => setCatForm({ id: c.id, name: c.name, category_type: 'drink', is_visible: true })}
                                    >
                                        Sửa
                                    </button>
                                </span>
                            ))}
                        </div>
                    </div>

                    <div style={{ background: '#fffbeb', padding: 12, borderRadius: 10, border: '1.5px solid #fcd34d' }}>
                        <strong style={{ display: 'block', marginBottom: 8 }}>
                            🥐 Danh mục Bánh ngọt & Đồ ăn ({foodCategories.length})
                        </strong>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                            {foodCategories.map((c) => (
                                <span
                                    key={c.id}
                                    className="badge badge-warning"
                                    style={{ padding: '6px 12px', display: 'inline-flex', alignItems: 'center', gap: 8 }}
                                >
                                    <span>🥐 {c.name}</span>
                                    <button
                                        type="button"
                                        className="btn-outline btn-sm"
                                        style={{ padding: '2px 6px', fontSize: 10 }}
                                        onClick={() => setCatForm({ id: c.id, name: c.name, category_type: 'food', is_visible: true })}
                                    >
                                        Sửa
                                    </button>
                                </span>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            <div className="card-panel">
                <div className="card-panel-header">
                    <h3>
                        {form.id
                            ? `✏️ Đang sửa Món #${form.id}: ${form.name}`
                            : '☕ Thêm Món Mới (Tự động lọc đúng Danh mục Thức uống / Bánh ngọt)'}
                    </h3>
                    <span className="badge badge-success">Tổng số: {products.length} món</span>
                </div>

                <form onSubmit={handleProductSubmit} style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                    <div>
                        <label>1. Chọn Phân loại Món trước</label>
                        <select
                            value={form.item_type}
                            onChange={(e) => {
                                const nextType = e.target.value;
                                const targetCats = nextType === 'food' ? foodCategories : drinkCategories;
                                const defaultImg = nextType === 'food' ? QUICK_SAMPLE_IMAGES[4].url : QUICK_SAMPLE_IMAGES[3].url;
                                setForm({
                                    ...form,
                                    item_type: nextType,
                                    category_id: targetCats[0]?.id || form.category_id,
                                    image_url: form.id ? form.image_url : defaultImg
                                });
                            }}
                        >
                            <option value="drink">🥤 Thức uống (Tính theo Ly • Có đường & đá)</option>
                            <option value="food">🥐 Bánh ngọt & Đồ ăn (Tính theo Cái • Không đường & đá)</option>
                        </select>
                    </div>

                    <div>
                        <label>
                            {form.item_type === 'food'
                                ? '2. Danh mục Bánh ngọt & Đồ ăn (Đã lọc riêng)'
                                : '2. Danh mục Thức uống (Đã lọc riêng)'}
                        </label>
                        <select
                            value={form.category_id}
                            onChange={(e) => setForm({ ...form, category_id: Number(e.target.value) })}
                        >
                            {matchingCategoriesForForm.map((c) => (
                                <option key={c.id} value={c.id}>
                                    {form.item_type === 'food' ? `🥐 ${c.name}` : `🥤 ${c.name}`}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label>3. Tên món {form.item_type === 'food' ? 'bánh / đồ ăn' : 'thức uống'}</label>
                        <input
                            placeholder={
                                form.item_type === 'food'
                                    ? 'VD: Bánh Croissant Bơ Pháp, Bánh Tiramisu...'
                                    : 'VD: Trà Đào Cam Sả, Trà Ổi Hồng, Bạc Xỉu...'
                            }
                            value={form.name}
                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                            required
                        />
                    </div>

                    <div>
                        <label>{`Giá bán tiêu chuẩn (VNĐ / ${form.item_type === 'food' ? 'cái' : 'ly'})`}</label>
                        <input
                            type="number"
                            placeholder="45000"
                            value={form.base_price}
                            onChange={(e) => setForm({ ...form, base_price: e.target.value })}
                            required
                        />
                    </div>
                    <div>
                        <label>Năng lượng (Calories)</label>
                        <input
                            type="number"
                            value={form.calories}
                            onChange={(e) => setForm({ ...form, calories: e.target.value })}
                        />
                    </div>
                    <div>
                        <label>Mô tả thành phần / hương vị</label>
                        <input
                            placeholder="Mô tả hương vị giúp khách dễ chọn món..."
                            value={form.description}
                            onChange={(e) => setForm({ ...form, description: e.target.value })}
                        />
                    </div>

                    <div
                        style={{
                            gridColumn: 'span 3',
                            display: 'grid',
                            gridTemplateColumns: '1fr auto 90px',
                            gap: 14,
                            alignItems: 'center',
                            background: '#f8fafc',
                            padding: 14,
                            borderRadius: 10,
                            border: '1.5px dashed #94a3b8'
                        }}
                    >
                        <div>
                            <label>🖼️ Hình ảnh món (Dán Link URL, Tải ảnh từ máy tính hoặc Bấm chọn ảnh mẫu):</label>
                            <input
                                type="text"
                                placeholder="Dán đường dẫn ảnh https://... hoặc tải file ảnh"
                                value={form.image_url}
                                onChange={(e) => setForm({ ...form, image_url: e.target.value })}
                                required
                            />
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                                <small style={{ fontWeight: 700, alignSelf: 'center' }}>Ảnh mẫu nhanh:</small>
                                {QUICK_SAMPLE_IMAGES.map((sample, idx) => (
                                    <button
                                        key={idx}
                                        type="button"
                                        className="btn-outline btn-sm"
                                        onClick={() => setForm({ ...form, image_url: sample.url })}
                                    >
                                        {sample.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                onChange={handleFileUpload}
                                style={{ display: 'none' }}
                            />
                            <button
                                type="button"
                                className="btn-primary"
                                onClick={() => fileInputRef.current?.click()}
                            >
                                {uploadingImage ? 'Đang xử lý...' : '📤 Tải ảnh từ máy'}
                            </button>
                        </div>

                        <div
                            style={{
                                width: 84,
                                height: 84,
                                borderRadius: 10,
                                overflow: 'hidden',
                                border: '2px solid #000',
                                background: '#fff',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}
                        >
                            {form.image_url ? (
                                <img
                                    src={form.image_url}
                                    alt="Preview"
                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                />
                            ) : (
                                <span style={{ fontSize: 28 }}>{form.item_type === 'food' ? '🥐' : '☕'}</span>
                            )}
                        </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, margin: 0 }}>
                            <input
                                type="checkbox"
                                checked={form.is_available}
                                onChange={(e) => setForm({ ...form, is_available: e.target.checked })}
                            />
                            <span>Còn hàng (Mở bán)</span>
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, margin: 0 }}>
                            <input
                                type="checkbox"
                                checked={form.is_visible}
                                onChange={(e) => setForm({ ...form, is_visible: e.target.checked })}
                            />
                            <span>Hiển thị cho Khách đặt món</span>
                        </label>
                    </div>

                    <div style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                        {form.id && (
                            <button type="button" className="btn-outline" onClick={resetForm}>
                                Hủy sửa
                            </button>
                        )}
                        <button type="submit" className="btn-success">
                            {form.id ? '💾 Lưu Cập nhật Món & Ảnh' : '+ Thêm Món vào Menu'}
                        </button>
                    </div>
                </form>

                <div style={{ display: 'flex', gap: 8, marginTop: 20, marginBottom: 10 }}>
                    <button
                        type="button"
                        className={adminFilterTab === 'ALL' ? 'btn-primary btn-sm' : 'btn-outline btn-sm'}
                        onClick={() => setAdminFilterTab('ALL')}
                    >
                        Tất cả ({products.length})
                    </button>
                    <button
                        type="button"
                        className={adminFilterTab === 'DRINK' ? 'btn-primary btn-sm' : 'btn-outline btn-sm'}
                        onClick={() => setAdminFilterTab('DRINK')}
                    >
                        🥤 Chỉ Thức uống ({products.filter((p) => !isFoodProduct(p)).length})
                    </button>
                    <button
                        type="button"
                        className={adminFilterTab === 'FOOD' ? 'btn-warning btn-sm' : 'btn-outline btn-sm'}
                        onClick={() => setAdminFilterTab('FOOD')}
                    >
                        🥐 Chỉ Bánh ngọt & Đồ ăn ({products.filter((p) => isFoodProduct(p)).length})
                    </button>
                </div>

                <table className="modern-table">
                    <thead>
                        <tr>
                            <th>Hình ảnh</th>
                            <th>Mã</th>
                            <th>Tên món & Mô tả</th>
                            <th>Phân loại</th>
                            <th>Danh mục riêng</th>
                            <th>Giá bán</th>
                            <th>Đã bán</th>
                            <th>Hiển thị & Kho</th>
                            <th>Thao tác</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredAdminProducts.map((p) => {
                            const isFood = isFoodProduct(p);
                            const unitLabel = isFood ? 'cái' : 'ly';
                            return (
                                <tr key={p.id}>
                                    <td>
                                        <img
                                            src={getProductImage(p)}
                                            alt={p.name}
                                            style={{
                                                width: 56,
                                                height: 56,
                                                borderRadius: 10,
                                                objectFit: 'cover',
                                                border: '1.5px solid #94a3b8'
                                            }}
                                        />
                                    </td>
                                    <td><b>#{p.id}</b></td>
                                    <td>
                                        <div style={{ fontWeight: 800, fontSize: 14 }}>{p.name}</div>
                                        <div style={{ fontSize: 12 }}>{(p.description || '').replace(/^\[Đồ ăn\]\s*/i, '') || '—'}</div>
                                        <small>{p.calories || 150} kcal</small>
                                    </td>
                                    <td>
                                        <span className={`badge ${isFood ? 'badge-warning' : 'badge-loyal'}`}>
                                            {isFood ? '🥐 Bánh & Đồ ăn (cái)' : '🥤 Thức uống (ly)'}
                                        </span>
                                    </td>
                                    <td>
                                        <b>{isFood ? `🥐 ${p.category_name}` : `🥤 ${p.category_name}`}</b>
                                    </td>
                                    <td style={{ fontWeight: 800 }}>
                                        {Number(p.base_price || 0).toLocaleString('vi-VN')}đ
                                    </td>
                                    <td>
                                        <b>{Number(p.sold_count || 0)} {unitLabel}</b>
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                            {p.is_available ? (
                                                <span className="badge badge-success">Đang mở bán</span>
                                            ) : (
                                                <span className="badge badge-danger">Tạm hết hàng</span>
                                            )}
                                            {!p.is_visible && (
                                                <span className="badge badge-standard">Đang ẩn trên Menu</span>
                                            )}
                                        </div>
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', gap: 6 }}>
                                            <button
                                                type="button"
                                                className="btn-outline btn-sm"
                                                onClick={() => handleEditClick(p)}
                                            >
                                                ✏️ Sửa
                                            </button>
                                            <button
                                                type="button"
                                                className="btn-danger btn-sm"
                                                onClick={() => onDeleteProduct(p.id)}
                                            >
                                                🗑️ Xóa
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}