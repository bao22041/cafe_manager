// frontend/src/components/customer/ProductFilterBar.jsx
import React from 'react';
import { isFoodCategory } from './ProductOptionModal';

const getCategoryIcon = (cat) => {
    if (isFoodCategory(cat)) return '🥐';
    const name = String(cat.name || '').toLowerCase();
    if (name.includes('trà trái cây') || name.includes('hoa quả')) return '🍑';
    if (name.includes('trà sữa') || name.includes('macchiato')) return '🧋';
    return '☕';
};

export default function ProductFilterBar({ categories = [], filters, setFilters, itemGroupTab = 'ALL' }) {
    const visibleCategories = categories.filter((c) => {
        const isFoodCat = isFoodCategory(c);
        if (itemGroupTab === 'DRINK') return !isFoodCat;
        if (itemGroupTab === 'FOOD') return isFoodCat;
        return true;
    });

    return (
        <div className="filter-toolbar">
            <div className="category-pills">
                <button
                    type="button"
                    className={`cat-pill ${filters.category_id === '' ? 'active' : ''}`}
                    onClick={() => setFilters({ ...filters, category_id: '' })}
                >
                    ✨ Tất cả danh mục {itemGroupTab === 'DRINK' ? 'Thức uống' : itemGroupTab === 'FOOD' ? 'Bánh ngọt & Đồ ăn' : ''}
                </button>
                {visibleCategories.map((c) => (
                    <button
                        type="button"
                        key={c.id}
                        className={`cat-pill ${String(filters.category_id) === String(c.id) ? 'active' : ''}`}
                        onClick={() => setFilters({ ...filters, category_id: c.id })}
                    >
                        {`${getCategoryIcon(c)} ${c.name}`}
                    </button>
                ))}
            </div>

            <div className="filter-inputs-row">
                <input
                    placeholder="🔍 Tìm kiếm tên đồ uống, trà trái cây, bánh ngọt..."
                    value={filters.search}
                    onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                />
                <select value={filters.sort_by} onChange={(e) => setFilters({ ...filters, sort_by: e.target.value })}>
                    <option value="">Sắp xếp: Mới nhất</option>
                    <option value="best_selling">🔥 Độ bán chạy nhất</option>
                    <option value="price_asc">⬆️ Giá thấp đến cao</option>
                    <option value="price_desc">⬇️ Giá cao đến thấp</option>
                </select>
                <input
                    type="number"
                    placeholder="💰 Giá tối đa (VNĐ)"
                    value={filters.max_price}
                    onChange={(e) => setFilters({ ...filters, max_price: e.target.value })}
                />
            </div>
        </div>
    );
}