'use client';

import { useState, useEffect } from 'react';
import { useCreateEvent } from './CreateEventProvider';
import { v4 as uuidv4 } from 'uuid';

type FieldType = 'text' | 'number' | 'select' | 'file';

interface FormFieldEditorProps {
  field: {
    id: string;
    label: string;
    field_type: FieldType;
    required: boolean;
    options?: string[];
    disabled?: boolean;
    original_required?: boolean;
  };
  index: number;
  total: number;
  onUpdate: (id: string, updates: any) => void;
  onRemove: (id: string) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

const FormFieldEditor = ({ field, index, total, onUpdate, onRemove, onMoveUp, onMoveDown }: FormFieldEditorProps) => {
  const [options, setOptions] = useState<string>(field.options?.join(', ') || '');
  const [isExpanded, setIsExpanded] = useState(true);

  useEffect(() => {
    if (field.field_type === 'select' && options) {
      const optionsArray = options
        .split(',')
        .map(opt => opt.trim())
        .filter(opt => opt.length > 0);
      onUpdate(field.id, { options: optionsArray });
    }
  }, [options, field.field_type, field.id, onUpdate]);

  const handleTypeChange = (newType: FieldType) => {
    const updates: any = { field_type: newType };
    if (newType !== 'select') {
      updates.options = undefined;
    } else if (!field.options) {
      updates.options = [];
    }
    onUpdate(field.id, updates);
  };

  return (
    <div className="border border-slate-700 rounded-lg overflow-hidden bg-slate-800/50 mb-4">
      <div 
        className="flex items-center justify-between p-3 bg-slate-800/50 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center space-x-2">
          <span className="text-slate-400">
            {isExpanded ? '▼' : '►'}
          </span>
          <span className="font-medium text-white">{field.label || 'Untitled Field'}</span>
          <span className="text-xs px-2 py-0.5 bg-slate-700 text-slate-300 rounded-full">
            {field.field_type}
          </span>
          {field.required && (
            <span className="text-xs px-2 py-0.5 bg-red-900/50 text-red-300 rounded-full">
              Required
            </span>
          )}
        </div>
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onMoveUp();
            }}
            disabled={index === 0}
            className="text-slate-500 hover:text-slate-200 disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label="Move field up"
          >
            ▲
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onMoveDown();
            }}
            disabled={index === total - 1}
            className="text-slate-500 hover:text-slate-200 disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label="Move field down"
          >
            ▼
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRemove(field.id);
            }}
            className="text-slate-400 hover:text-red-400"
            aria-label="Remove field"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
      
      {isExpanded && (
        <div className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Field Label <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={field.label}
              onChange={(e) => onUpdate(field.id, { label: e.target.value })}
              className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
              placeholder="e.g., Phone Number, Company Name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Field Type
            </label>
            <select
              value={field.field_type}
              onChange={(e) => handleTypeChange(e.target.value as FieldType)}
              className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              <option value="text">Text</option>
              <option value="number">Number</option>
              <option value="select">Dropdown</option>
              <option value="file">File Upload</option>
            </select>
          </div>

          {field.field_type === 'select' && (
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Options (comma separated)
              </label>
              <input
                type="text"
                value={options}
                onChange={(e) => setOptions(e.target.value)}
                className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
                placeholder="e.g., Option 1, Option 2, Option 3"
              />
              <p className="mt-1 text-xs text-slate-400">
                Separate options with commas
              </p>
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center">
              <input
                id={`required-${field.id}`}
                type="checkbox"
                checked={field.required}
                onChange={(e) => {
                  const newRequired = e.target.checked;
                  const updates: any = { required: newRequired };
                  if (typeof field.original_required !== 'boolean') {
                    updates.original_required = field.required;
                  }
                  onUpdate(field.id, updates);
                }}
                className="h-4 w-4 rounded border-slate-600 bg-slate-800 text-sky-500 focus:ring-sky-500"
              />
              <label
                htmlFor={`required-${field.id}`}
                className="ml-2 block text-sm text-slate-300"
              >
                Required field
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300">
              <button
                type="button"
                className="rounded border border-slate-600 px-2 py-1 hover:border-sky-500 hover:text-sky-300"
                onClick={() => {
                  const updates: any = {};
                  if (typeof field.original_required !== 'boolean') {
                    updates.original_required = field.required;
                    updates.required = !field.required;
                  } else {
                    updates.required = !field.required;
                  }
                  onUpdate(field.id, updates);
                }}
              >
                Override required
              </button>

              {typeof field.original_required === 'boolean' && field.required !== field.original_required && (
                <button
                  type="button"
                  className="rounded border border-emerald-600 px-2 py-1 text-emerald-200 hover:bg-emerald-900/40"
                  onClick={() => onUpdate(field.id, { required: field.original_required })}
                >
                  Restore original required
                </button>
              )}

              <div className="flex items-center">
                <input
                  id={`disabled-${field.id}`}
                  type="checkbox"
                  checked={!!field.disabled}
                  onChange={(e) => onUpdate(field.id, { disabled: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-600 bg-slate-800 text-red-500 focus:ring-red-500"
                />
                <label
                  htmlFor={`disabled-${field.id}`}
                  className="ml-2 block text-sm text-slate-300"
                >
                  Disable field
                </label>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export function FormBuilderSection() {
  const { state, addFormField, updateFormField, removeFormField, moveFormField } = useCreateEvent();
  
  const defaultFields = [
    {
      id: 'full_name',
      label: 'Full Name',
      field_type: 'text' as const,
      required: true,
      disabled: true,
      disabled_by: 'system',
    },
    {
      id: 'email',
      label: 'Email',
      field_type: 'text' as const,
      required: true,
      disabled: true,
      disabled_by: 'system',
    },
  ];

  const handleAddField = () => {
    const newField = {
      id: `field-${uuidv4()}`,
      label: '',
      field_type: 'text' as const,
      required: false,
    };
    addFormField(newField);
  };

  const handleUpdateField = (id: string, updates: any) => {
    updateFormField(id, updates);
  };

  const handleRemoveField = (id: string) => {
    removeFormField(id);
  };

  return (
    <div className="space-y-4">
      <div className="border-b border-slate-700 pb-2">
        <h2 className="text-lg font-semibold text-white">Registration Form Builder</h2>
        <p className="text-sm text-slate-400">
          Customize the registration form with additional fields
        </p>
      </div>

      <div className="space-y-4">
        <div className="rounded-lg border border-slate-700 bg-slate-800/30 p-4">
          <h3 className="text-sm font-medium text-white mb-2">Default Fields</h3>
          <p className="text-xs text-slate-400 mb-3">
            These fields are included by default and cannot be removed or modified
          </p>
          
          <div className="space-y-2">
            {defaultFields.map((field) => (
              <div key={field.id} className="flex items-center justify-between p-2 bg-slate-800/50 rounded">
                <div className="flex items-center space-x-2">
                  <span className="text-white">{field.label}</span>
                  <span className="text-xs px-1.5 py-0.5 bg-slate-700 text-slate-300 rounded">
                    {field.field_type}
                  </span>
                  {field.required && (
                    <span className="text-xs px-1.5 py-0.5 bg-red-900/30 text-red-300 rounded">
                      Required
                    </span>
                  )}
                </div>
                <span className="text-xs text-slate-500">System field</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-white">Custom Fields</h3>
            <button
              type="button"
              onClick={handleAddField}
              className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white bg-sky-600 hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500"
            >
              <svg className="-ml-0.5 mr-1.5 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Add Field
            </button>
          </div>

          {state.data.form_fields.length === 0 ? (
            <div className="text-center py-8 border-2 border-dashed border-slate-700 rounded-lg">
              <svg
                className="mx-auto h-12 w-12 text-slate-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-white">No custom fields</h3>
              <p className="mt-1 text-sm text-slate-400">
                Add custom fields to collect additional information from attendees.
              </p>
              <div className="mt-4">
                <button
                  type="button"
                  onClick={handleAddField}
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-sky-600 hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500"
                >
                  <svg className="-ml-1 mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  Add your first field
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {state.data.form_fields.map((field, index) => (
                <FormFieldEditor
                  key={field.id}
                  field={field}
                  index={index}
                  total={state.data.form_fields.length}
                  onUpdate={handleUpdateField}
                  onRemove={handleRemoveField}
                  onMoveUp={() => moveFormField(index, index - 1)}
                  onMoveDown={() => moveFormField(index, index + 1)}
                />
              ))}
              
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={handleAddField}
                  className="inline-flex items-center px-4 py-2 border border-dashed border-slate-600 rounded-md shadow-sm text-sm font-medium text-slate-300 bg-slate-800/50 hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500"
                >
                  <svg className="-ml-1 mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  Add Another Field
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
