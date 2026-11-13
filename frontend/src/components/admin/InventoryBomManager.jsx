import React, { useState } from 'react';

export default function InventoryBomManager({ products, inventory, onSaveIngredient, onSaveBOM }) {
    const [ingForm, setIngForm] = useState({ id: '', name: '', unit: 'gram', stock_quantity: 2000, min_threshold: 300 });
    const [bomForm, setBomForm] = useState({
        product_id: products[0]?.id || 1,
        ingredient_id: inventory.ingredients[0]?.id || 1,
        quantity_required: 25
    });

    return (
        <div>
            <div className="card-panel">
                <div className="card-panel-header">
                    <h3>📦 Nhập Kho Nguyên liệu & Thiết lập Ngưỡng Cảnh báo</h3>
                </div>
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        onSaveIngredient(ingForm);
                        setIngForm({ id: '', name: '', unit: 'gram', stock_quantity: 2000, min_threshold: 300 });
                    }}
                    style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: 12, alignItems: 'end' }}
                >
                    <div>
                        <label>Tên nguyên liệu</label>
                        <input placeholder="VD: Hạt Arabica Cầu Đất" value={ingForm.name} onChange={(e) => setIngForm({ ...ingForm, name: e.target.value })} required />
                    </div>
                    <div>
                        <label>Đơn vị tính</label>
                        <input placeholder="gram / ml / cái" value={ingForm.unit} onChange={(e) => setIngForm({ ...ingForm, unit: e.target.value })} required />
                    </div>
                    <div>
                        <label>Tồn kho hiện tại</label>
                        <input type="number" value={ingForm.stock_quantity} onChange={(e) => setIngForm({ ...ingForm, stock_quantity: e.target.value })} required />
                    </div>
                    <div>
                        <label>Ngưỡng báo sắp hết</label>
                        <input type="number" value={ingForm.min_threshold} onChange={(e) => setIngForm({ ...ingForm, min_threshold: e.target.value })} required />
                    </div>
                    <button type="submit" className="btn-primary">{ingForm.id ? 'Cập nhật Kho' : '+ Nhập Kho'}</button>
                </form>

                <table className="modern-table" style={{ marginTop: 20 }}>
                    <thead>
                        <tr><th>Mã</th><th>Nguyên liệu</th><th>Số lượng tồn</th><th>Ngưỡng tối thiểu</th><th>Trạng thái Kho</th><th>Chỉnh sửa</th></tr>
                    </thead>
                    <tbody>
                        {inventory.ingredients.map((ing) => {
                            const isLow = Number(ing.stock_quantity) <= Number(ing.min_threshold);
                            return (
                                <tr key={ing.id}>
                                    <td>#{ing.id}</td>
                                    <td><b>{ing.name}</b></td>
                                    <td style={{ fontWeight: 700 }}>{Number(ing.stock_quantity).toLocaleString()} {ing.unit}</td>
                                    <td>{Number(ing.min_threshold).toLocaleString()} {ing.unit}</td>
                                    <td>
                                        {isLow
                                            ? <span className="badge badge-danger">⚠️ Sắp hết nguyên liệu</span>
                                            : <span className="badge badge-success">✓ Đủ định mức</span>}
                                    </td>
                                    <td>
                                        <button type="button" className="btn-outline btn-sm" onClick={() => setIngForm(ing)}>Sửa tồn kho</button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            <div className="card-panel">
                <div className="card-panel-header">
                    <h3>⚖️ Định lượng Tiêu hao Tự động (Bill of Materials - BOM)</h3>
                    <small style={{ color: '#64748b' }}>Tự động trừ kho mỗi khi bán ra 1 ly đồ uống</small>
                </div>
                <form
                    onSubmit={(e) => { e.preventDefault(); onSaveBOM(bomForm); }}
                    style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 12, alignItems: 'end' }}
                >
                    <div>
                        <label>Chọn Món nước</label>
                        <select value={bomForm.product_id} onChange={(e) => setBomForm({ ...bomForm, product_id: e.target.value })}>
                            {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label>Nguyên liệu cấu thành</label>
                        <select value={bomForm.ingredient_id} onChange={(e) => setBomForm({ ...bomForm, ingredient_id: e.target.value })}>
                            {inventory.ingredients.map((i) => <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>)}
                        </select>
                    </div>
                    <div>
                        <label>Định lượng tiêu hao / 1 ly</label>
                        <input type="number" value={bomForm.quantity_required} onChange={(e) => setBomForm({ ...bomForm, quantity_required: e.target.value })} required />
                    </div>
                    <button type="submit" className="btn-success">Lưu Định lượng BOM</button>
                </form>

                <table className="modern-table" style={{ marginTop: 18 }}>
                    <thead>
                        <tr><th>Món nước</th><th>Nguyên liệu tiêu hao</th><th>Định lượng trừ tự động / 1 ly</th></tr>
                    </thead>
                    <tbody>
                        {inventory.recipes.map((r) => (
                            <tr key={r.id}>
                                <td><b>{r.product_name}</b></td>
                                <td>{r.ingredient_name}</td>
                                <td><span className="badge badge-loyal">-{r.quantity_required} {r.unit}</span></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}