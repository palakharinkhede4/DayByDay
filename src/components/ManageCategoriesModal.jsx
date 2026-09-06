import React, { useState, useEffect } from 'react';
import { X, Trash2, Plus, Folder, AlertTriangle, Check } from 'lucide-react';
import { useHabits } from '../context/HabitContext';
import { sound } from '../utils/sound';

export const ManageCategoriesModal = ({ isOpen, onClose }) => {
  const { customCategories, addCustomCategory, deleteCustomCategory, habits } = useHabits();
  const [newCatName, setNewCatName] = useState('');
  const [catToDelete, setCatToDelete] = useState(null);

  // Lock body scroll while modal is active
  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleAdd = (e) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    sound.tap();
    addCustomCategory(newCatName.trim());
    setNewCatName('');
  };

  const handleConfirmDelete = (cat) => {
    sound.tap();
    deleteCustomCategory(cat);
    setCatToDelete(null);
  };

  return (
    <div className="manage-categories-modal-backdrop" onClick={onClose}>
      <div className="manage-categories-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="manage-cat-header">
          <div className="manage-cat-title-group">
            <div className="manage-cat-icon-badge">
              <Folder size={20} />
            </div>
            <div>
              <h3 className="manage-cat-title font-extrabold">Manage Categories</h3>
              <p className="manage-cat-subtitle">Organize, add, or delete your habit categories</p>
            </div>
          </div>
          <button
            type="button"
            className="manage-cat-close-btn"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Add New Category Input */}
        <form onSubmit={handleAdd} className="manage-cat-form">
          <input
            type="text"
            value={newCatName}
            onChange={(e) => setNewCatName(e.target.value)}
            placeholder="New category name (e.g. Study, Finance)"
            className="manage-cat-input font-medium"
            maxLength={20}
          />
          <button
            type="submit"
            disabled={!newCatName.trim()}
            className="manage-cat-add-btn font-bold"
          >
            <Plus size={16} />
            <span>Add</span>
          </button>
        </form>

        {/* Categories List */}
        <div className="manage-cat-list">
          {customCategories.map((cat) => {
            const isDaily = cat.toLowerCase() === 'daily';
            const count = habits.filter(
              (h) => (h.category || 'Daily').toLowerCase() === cat.toLowerCase()
            ).length;
            const isConfirming = catToDelete === cat;

            return (
              <div key={cat} className="manage-cat-item">
                <div className="manage-cat-item-left">
                  <span className="manage-cat-name font-bold">{cat}</span>
                  {isDaily ? (
                    <span className="manage-cat-default-badge font-bold">
                      Default
                    </span>
                  ) : (
                    <span className="manage-cat-count-badge">
                      {count} {count === 1 ? 'habit' : 'habits'}
                    </span>
                  )}
                </div>

                {/* Actions */}
                {!isDaily && (
                  <div className="manage-cat-item-right">
                    {isConfirming ? (
                      <div className="manage-cat-confirm-wrap">
                        <span className="manage-cat-confirm-text">Move {count} to Daily?</span>
                        <button
                          type="button"
                          className="manage-cat-btn-delete font-bold"
                          onClick={() => handleConfirmDelete(cat)}
                        >
                          Delete
                        </button>
                        <button
                          type="button"
                          className="manage-cat-btn-cancel"
                          onClick={() => setCatToDelete(null)}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="manage-cat-trash-btn"
                        onClick={() => {
                          sound.tap();
                          setCatToDelete(cat);
                        }}
                        title={`Delete ${cat} category`}
                        aria-label={`Delete ${cat} category`}
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer Note */}
        <div className="manage-cat-footer">
          <p className="manage-cat-note">
            Deleting a category moves all its habits to <strong style={{ color: 'var(--text-primary)' }}>Daily</strong>.
          </p>
          <button
            type="button"
            className="manage-cat-done-btn font-semibold"
            onClick={onClose}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
