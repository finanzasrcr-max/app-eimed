import React, { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, X, Check } from 'lucide-react';

export interface ComboboxOption {
  id: string;
  label: string;
  sublabel?: string;
  badge?: string;
}

interface SearchableComboboxProps {
  options: ComboboxOption[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  label?: string;
  required?: boolean;
  disabled?: boolean;
  emptyMessage?: string;
}

const SearchableCombobox: React.FC<SearchableComboboxProps> = ({
  options,
  value,
  onChange,
  placeholder = 'Buscar o seleccionar...',
  label,
  required,
  disabled,
  emptyMessage = 'Sin resultados',
}) => {
  const [query, setQuery]   = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const containerRef        = useRef<HTMLDivElement>(null);
  const inputRef            = useRef<HTMLInputElement>(null);

  const selected = options.find(o => o.id === value);

  const filtered = query.trim()
    ? options.filter(o =>
        o.label.toLowerCase().includes(query.toLowerCase()) ||
        (o.sublabel || '').toLowerCase().includes(query.toLowerCase()) ||
        (o.badge || '').toLowerCase().includes(query.toLowerCase())
      )
    : options;

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSelect = (id: string) => {
    onChange(id);
    setIsOpen(false);
    setQuery('');
  };

  const handleOpen = () => {
    if (disabled) return;
    setIsOpen(true);
    setQuery('');
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setQuery('');
    setIsOpen(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    if (!isOpen) setIsOpen(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { setIsOpen(false); setQuery(''); }
    if (e.key === 'Enter' && filtered.length === 1) {
      e.preventDefault();
      handleSelect(filtered[0].id);
    }
  };

  return (
    <div className="scb-root" ref={containerRef}>
      {label && (
        <label className="text-xs font-bold uppercase" style={{ color: 'var(--text-muted)', letterSpacing: '0.06em' }}>
          {label}
        </label>
      )}

      {/* Unified trigger + input */}
      <div
        className={`scb-field${isOpen ? ' scb-open' : ''}${disabled ? ' scb-disabled' : ''}`}
        onClick={handleOpen}
      >
        <Search size={15} className="scb-icon" />

        <input
          ref={inputRef}
          type="text"
          className="scb-input"
          placeholder={selected ? selected.label : placeholder}
          value={isOpen ? query : (selected ? selected.label : '')}
          onChange={handleInputChange}
          onFocus={handleOpen}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          readOnly={!isOpen}
          style={{ cursor: disabled ? 'not-allowed' : isOpen ? 'text' : 'pointer' }}
        />

        {/* Hidden native input for form validation */}
        {required && (
          <input
            type="text"
            style={{ position: 'absolute', opacity: 0, width: 0, height: 0, pointerEvents: 'none' }}
            value={value}
            onChange={() => {}}
            required
            tabIndex={-1}
          />
        )}

        <div className="scb-actions">
          {value && !disabled && (
            <button type="button" className="scb-clear-btn" onClick={handleClear} title="Limpiar">
              <X size={13} />
            </button>
          )}
          <ChevronDown
            size={15}
            className="scb-chevron"
            style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.18s ease' }}
          />
        </div>
      </div>

      {/* Dropdown list */}
      {isOpen && (
        <div className="scb-dropdown">
          {filtered.length === 0 ? (
            <div className="scb-empty">
              <Search size={16} style={{ opacity: 0.4 }} />
              {query ? `Sin resultados para "${query}"` : emptyMessage}
            </div>
          ) : (
            <div className="scb-list">
              {filtered.map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  className={`scb-option${opt.id === value ? ' scb-selected' : ''}`}
                  onClick={() => handleSelect(opt.id)}
                >
                  <div className="scb-opt-main">
                    <span className="scb-opt-label">{opt.label}</span>
                    {opt.sublabel && <span className="scb-opt-sub">{opt.sublabel}</span>}
                  </div>
                  <div className="scb-opt-right">
                    {opt.badge && <span className="scb-opt-badge">{opt.badge}</span>}
                    {opt.id === value && <Check size={14} style={{ color: 'var(--primary-600)', flexShrink: 0 }} />}
                  </div>
                </button>
              ))}
            </div>
          )}
          <div className="scb-footer">
            {filtered.length} resultado{filtered.length !== 1 ? 's' : ''}{query && ` para "${query}"`}
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchableCombobox;
