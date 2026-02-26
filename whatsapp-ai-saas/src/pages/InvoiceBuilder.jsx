import React, { useState, useEffect } from 'react';
import useAppStore from '../store';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const SortableInvoiceItem = ({ item, onUpdate, onRemove }) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: item.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 100 : 1,
        opacity: isDragging ? 0.8 : 1,
        position: 'relative',
    };

    return (
        <div ref={setNodeRef} style={style} className={`invoice-row ${isDragging ? 'dragging' : ''}`}>
            <div className="drag-handle" {...attributes} {...listeners}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
            </div>

            <div className="invoice-col-desc">
                <input
                    type="text"
                    value={item.description}
                    onChange={(e) => onUpdate(item.id, 'description', e.target.value)}
                    placeholder="Item description"
                />
            </div>

            <div className="invoice-col-qty">
                <input
                    type="number"
                    min="1"
                    value={item.qty}
                    onChange={(e) => onUpdate(item.id, 'qty', parseInt(e.target.value) || 0)}
                />
            </div>

            <div className="invoice-col-price">
                <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.price}
                    onChange={(e) => onUpdate(item.id, 'price', parseFloat(e.target.value) || 0)}
                />
            </div>

            <div className="invoice-col-total">
                ${(item.qty * item.price).toFixed(2)}
            </div>

            <button className="btn-icon text-danger delete-row" onClick={() => onRemove(item.id)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>
        </div>
    );
};

const InvoiceBuilder = () => {
    const [clientName, setClientName] = useState('Acme Corporation');
    const [clientEmail, setClientEmail] = useState('billing@acme.inc');
    const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
    const [taxRate, setTaxRate] = useState(20); // Default 20%
    const [currency, setCurrency] = useState('EUR');

    const [items, setItems] = useState([
        { id: '1', description: 'Social Media Strategy Q1', qty: 1, price: 1500.00 },
        { id: '2', description: 'Landing Page Copywriting', qty: 1, price: 850.00 },
        { id: '3', description: 'Monthly Consultation Hours', qty: 5, price: 120.00 },
    ]);

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragEnd = (event) => {
        const { active, over } = event;
        if (active.id !== over.id) {
            setItems((items) => {
                const oldIndex = items.findIndex(item => item.id === active.id);
                const newIndex = items.findIndex(item => item.id === over.id);
                return arrayMove(items, oldIndex, newIndex);
            });
        }
    };

    const updateItem = (id, field, value) => {
        setItems(items.map(item => item.id === id ? { ...item, [field]: value } : item));
    };

    const removeItem = (id) => {
        setItems(items.filter(item => item.id !== id));
    };

    const addItem = () => {
        const newItem = {
            id: `item-${Date.now()}`,
            description: '',
            qty: 1,
            price: 0
        };
        setItems([...items, newItem]);
    };

    const subtotal = items.reduce((acc, item) => acc + (item.qty * item.price), 0);
    const taxAmount = subtotal * (taxRate / 100);
    const total = subtotal + taxAmount;

    return (
        <div className="invoice-module">
            <div className="invoice-header-actions no-print">
                <div>
                    <h2 style={{ fontSize: '24px', fontWeight: 600, margin: 0 }}>Invoice Builder</h2>
                    <p style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>Create, arrange, and export professional invoices.</p>
                </div>
                <button className="btn-primary" onClick={() => window.print()}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
                    Print / Save PDF
                </button>
            </div>

            <div className="invoice-document" id="invoice">
                {/* INVOICE HEADER */}
                <div className="invoice-top">
                    <div>
                        <h1 style={{ fontSize: '32px', margin: 0, fontWeight: 700, color: 'var(--primary-color)' }}>INVOICE</h1>
                        <p style={{ color: 'var(--text-secondary)' }}>#{Date.now().toString().slice(-6)}</p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <h3 style={{ margin: 0 }}>Auceps Digital</h3>
                        <p style={{ margin: '4px 0', color: 'var(--text-secondary)' }}>123 Creative Avenue<br />Paris, France 75001<br />contact@auceps.com</p>
                    </div>
                </div>

                <div className="invoice-meta">
                    <div className="meta-block">
                        <label>Billed To:</label>
                        <input className="borderless-input bold" value={clientName} onChange={e => setClientName(e.target.value)} placeholder="Client Name" />
                        <input className="borderless-input" value={clientEmail} onChange={e => setClientEmail(e.target.value)} placeholder="Client Email" />
                    </div>
                    <div className="meta-block text-right">
                        <label>Date:</label>
                        <input type="date" className="borderless-input text-right" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} />
                    </div>
                </div>

                {/* ITEMS TABLE */}
                <div className="invoice-table">
                    <div className="invoice-th">
                        <div className="invoice-col-desc">Description</div>
                        <div className="invoice-col-qty">Hrs/Qty</div>
                        <div className="invoice-col-price">Rate</div>
                        <div className="invoice-col-total">Line Total</div>
                    </div>

                    <div className="invoice-tb">
                        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                            <SortableContext items={items} strategy={verticalListSortingStrategy}>
                                {items.map(item => (
                                    <SortableInvoiceItem
                                        key={item.id}
                                        item={item}
                                        onUpdate={updateItem}
                                        onRemove={removeItem}
                                    />
                                ))}
                            </SortableContext>
                        </DndContext>
                    </div>
                </div>

                <button className="btn-secondary add-row-btn no-print" onClick={addItem}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                    Add Custom Line
                </button>

                {/* TOTALS */}
                <div className="invoice-totals">
                    <div className="total-row">
                        <span>Subtotal:</span>
                        <span>{subtotal.toLocaleString('en-US', { style: 'currency', currency })}</span>
                    </div>
                    <div className="total-row">
                        <span>
                            Tax Rate:
                            <input type="number" className="tax-input no-print" value={taxRate} onChange={e => setTaxRate(parseFloat(e.target.value) || 0)} style={{ width: 50, marginLeft: 8 }} />%
                            <span className="print-only" style={{ marginLeft: 8 }}>{taxRate}%</span>
                        </span>
                        <span>{taxAmount.toLocaleString('en-US', { style: 'currency', currency })}</span>
                    </div>
                    <div className="total-row grand-total">
                        <span>Total Due:</span>
                        <span>{total.toLocaleString('en-US', { style: 'currency', currency })}</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default InvoiceBuilder;
