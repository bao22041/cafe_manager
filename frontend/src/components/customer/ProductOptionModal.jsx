// frontend/src/components/customer/ProductOptionModal.jsx
import React, { useState, useEffect } from 'react';

// Hàm nhận diện Danh mục thuộc nhóm Đồ ăn / Bánh ngọt hay Thức uống
export const isFoodCategory = (category) => {
    if (!category) return false;
    if (category.category_type === 'food') return true;
    if (category.category_type === 'drink') return false;
    const name = String(category.name || '').toLowerCase();
    if (name.includes('trà') && !name.includes('bánh')) return false;
    const foodCatKeywords = ['bánh', 'đồ ăn', 'thức ăn', 'ăn vặt', 'snack', 'bakery', 'pastry', 'food', 'điểm tâm'];
    return foodCatKeywords.some((kw) => name.includes(kw));
};

// Hàm nhận diện Món là Đồ ăn (cái, không đường/đá) hay Thức uống (ly, có đường/đá)
export const isFoodProduct = (product) => {
    if (!product) return false;

    if (product.item_type === 'drink' || product.type === 'drink' || product.is_food === false || product.is_food === 0) {
        return false;
    }
    if (product.item_type === 'food' || product.type === 'food' || product.is_food === true || product.is_food === 1) {
        return true;
    }

    const name = String(product.name || '').toLowerCase().trim();
    const desc = String(product.description || '').toLowerCase().trim();
    const catName = String(product.category_name || '').toLowerCase().trim();

    const drinkKeywords = [
        'trà ', 'trà đào', 'trà vải', 'trà dâu', 'trà ổi', 'trà tắc', 'trà chanh', 'trà sen',
        'trà nhiệt đới', 'trà hoa quả', 'trà trái cây', 'trà sữa', 'ô long', 'hồng trà', 'lục trà',
        'cà phê', 'cafe', 'coffee', 'espresso', 'latte', 'cappuccino', 'americano', 'cold brew',
        'bạc xỉu', 'macchiato', 'matcha', 'cacao', 'sô cô la', 'chocolate', 'sinh tố',
        'nước ép', 'đá xay', 'freeze', 'soda', 'yakult', 'sữa tươi'
    ];
    if (drinkKeywords.some((kw) => name.includes(kw))) {
        return false;
    }

    const foodKeywords = [
        'bánh', '[đồ ăn]', 'đồ ăn', 'thức ăn', 'ăn vặt', 'snack', 'croissant', 'tiramisu',
        'mousse', 'flan', 'cheesecake', 'cookie', 'macaron', 'bò khô', 'khô gà',
        'hướng dương', 'khoai tây', 'xúc xích', 'sandwich', 'burger', 'pizza',
        'mì', 'cơm', 'salad', 'pastry', 'bakery', 'food', 'trái cây dĩa'
    ];
    if (foodKeywords.some((kw) => `${name} ${desc}`.includes(kw))) {
        return true;
    }

    if (product.category_type === 'food' || (catName.includes('bánh') && !catName.includes('trà'))) {
        return true;
    }

    return false;
};

const DRINK_SIZES = [
    { label: 'Size S (Tiêu chuẩn)', extra: 0 },
    { label: 'Size M (+5.000đ)', extra: 5000 },
    { label: 'Size L (+10.000đ)', extra: 10000 }
];
const SUGAR_OPTIONS = ['100% đường', '70% đường', '50% đường', '30% đường', 'Không đường'];
const ICE_OPTIONS = ['100% đá', '70% đá', '50% đá', 'Ít đá', 'Không đá', 'Đá riêng'];
const FOOD_SERVING_NOTES = ['Hâm nóng', 'Cắt nhỏ', 'Để hộp riêng', 'Thêm tương ớt', 'Không sốt'];

export default function ProductOptionModal({ product, onClose, onAddToCart }) {
    const [quantity, setQuantity] = useState(1);
    const [size, setSize] = useState(DRINK_SIZES[0]);
    const [sugar, setSugar] = useState('100% đường');
    const [ice, setIce] = useState('100% đá');
    const [note, setNote] = useState('');

    const isFood = isFoodProduct(product);
    const unitLabel = isFood ? 'cái' : 'ly';

    useEffect(() => {
        if (product) {
            const foodCheck = isFoodProduct(product);
            setQuantity(1);
            setSize(DRINK_SIZES[0]);
            setSugar(foodCheck ? '' : '100% đường');
            setIce(foodCheck ? '' : '100% đá');
            setNote('');
        }
    }, [product]);

    if (!product) return null;

    const unitPrice = Number(product.base_price || product.price || 0) + (isFood ? 0 : Number(size.extra || 0));
    const totalPrice = unitPrice * quantity;

    const handleConfirm = () => {
        const cleanNote = note.trim();
        const customOptions = isFood
            ? {
                  is_food: true,
                  unit: 'cái',
                  note: cleanNote || 'Phục vụ tiêu chuẩn'
              }
            : {
                  is_food: false,
                  unit: 'ly',
                  size: size.label,
                  sugar,
                  ice,
                  note: cleanNote
              };

        onAddToCart({
            product_id: product.id,
            name: product.name,
            product_name: product.name,
            is_food: isFood,
            unit_label: unitLabel,
            quantity: Number(quantity),
            unit_price: unitPrice,
            custom_options: customOptions
        });
        onClose();
    };

    const toggleFoodQuickNote = (tag) => {
        setNote((prev) => {
            if (prev.includes(tag)) {
                return prev.replace(tag, '').replace(/,\s*,/g, ',').replace(/^,\s*|,\s*$/g, '').trim();
            }
            return prev ? `${prev}, ${tag}` : tag;
        });
    };

    return (
        <div className="modal-backdrop" onClick={onClose}>
            <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <div>
                        <span className={`badge ${isFood ? 'badge-warning' : 'badge-loyal'}`} style={{ marginBottom: 6 }}>
                            {isFood ? '🥐 Bánh ngọt & Đồ ăn (Tính theo cái)' : '🥤 Thức uống (Tính theo ly)'}
                        </span>
                        <h3 style={{ margin: 0, fontSize: 18 }}>{product.name}</h3>
                        <small>
                            {`Danh mục: ${product.category_name || 'Thực đơn'} • Giá: ${Number(product.base_price || 0).toLocaleString('vi-VN')}đ/${unitLabel}`}
                        </small>
                    </div>
                    <button type="button" className="btn-outline btn-sm" onClick={onClose}>
                        ✕
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
                    <strong style={{ fontSize: 14 }}>{`Số lượng (${unitLabel}):`}</strong>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <button type="button" className="btn-outline btn-sm" onClick={() => setQuantity((q) => Math.max(1, q - 1))}>
                            −
                        </button>
                        <strong style={{ minWidth: 55, textAlign: 'center' }}>{`${quantity} ${unitLabel}`}</strong>
                        <button type="button" className="btn-outline btn-sm" onClick={() => setQuantity((q) => q + 1)}>
                            +
                        </button>
                    </div>
                </div>

                {!isFood ? (
                    <>
                        <div style={{ marginBottom: 12 }}>
                            <label>Chọn cỡ ly (Size):</label>
                            <div className="option-pill-group">
                                {DRINK_SIZES.map((s) => (
                                    <button
                                        key={s.label}
                                        type="button"
                                        className={`option-pill ${size.label === s.label ? 'active' : ''}`}
                                        onClick={() => setSize(s)}
                                    >
                                        {s.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div style={{ marginBottom: 12 }}>
                            <label>Lượng đường:</label>
                            <div className="option-pill-group">
                                {SUGAR_OPTIONS.map((s) => (
                                    <button
                                        key={s}
                                        type="button"
                                        className={`option-pill ${sugar === s ? 'active' : ''}`}
                                        onClick={() => setSugar(s)}
                                    >
                                        {s}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div style={{ marginBottom: 12 }}>
                            <label>Lượng đá:</label>
                            <div className="option-pill-group">
                                {ICE_OPTIONS.map((i) => (
                                    <button
                                        key={i}
                                        type="button"
                                        className={`option-pill ${ice === i ? 'active' : ''}`}
                                        onClick={() => setIce(i)}
                                    >
                                        {i}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </>
                ) : (
                    <div style={{ marginBottom: 12 }}>
                        <label>Tùy chọn phục vụ Bánh ngọt / Đồ ăn (Không áp dụng đường & đá):</label>
                        <div className="option-pill-group">
                            {FOOD_SERVING_NOTES.map((tag) => {
                                const active = note.includes(tag);
                                return (
                                    <button
                                        key={tag}
                                        type="button"
                                        className={`option-pill ${active ? 'active' : ''}`}
                                        onClick={() => toggleFoodQuickNote(tag)}
                                    >
                                        + {tag}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                <div style={{ marginBottom: 16 }}>
                    <label>Ghi chú thêm:</label>
                    <input
                        type="text"
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder={isFood ? 'VD: Hâm nóng giòn, mang ra ngay...' : 'VD: Ít sữa, bỏ ly mang về...'}
                    />
                </div>

                <div style={{ display: 'flex', gap: 10 }}>
                    <button type="button" className="btn-outline" style={{ flex: 1 }} onClick={onClose}>
                        Hủy
                    </button>
                    <button type="button" className="btn-success" style={{ flex: 2 }} onClick={handleConfirm}>
                        {`Thêm ${quantity} ${unitLabel} • ${totalPrice.toLocaleString('vi-VN')}đ`}
                    </button>
                </div>
            </div>
        </div>
    );
}