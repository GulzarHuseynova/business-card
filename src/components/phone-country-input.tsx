import { useId, useMemo, useState, type ChangeEvent } from 'react';
import { Input, Select, Space } from 'antd';
import {COUNTRY_PHONE_OPTIONS,DEFAULT_PHONE_COUNTRY_CODE,joinPhoneWithCountryCode,splitPhoneByCountryCode,} from '../utils/phone.utils';

interface PhoneCountryInputProps {
  id?: string;
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  maxLength?: number;
}

export function PhoneCountryInput({
  id,
  value,
  onChange,
  placeholder = 'Telefon nömrəsi',
  disabled = false,
  maxLength,
}: PhoneCountryInputProps) {
  const generatedId = useId();
  const inputId = id || `phone-${generatedId.replace(/:/g, '')}`;
  const countrySelectId = `${inputId}-country`;

  const [fallbackCountryCode, setFallbackCountryCode] = useState(
    DEFAULT_PHONE_COUNTRY_CODE,
  );

  const phoneParts = useMemo(
    () => splitPhoneByCountryCode(value, fallbackCountryCode),
    [fallbackCountryCode, value],
  );

  const selectedCountryCode = phoneParts.countryCode || fallbackCountryCode;

  const handleCountryChange = (nextCountryCode: string) => {
    setFallbackCountryCode(nextCountryCode);
    onChange?.(
      joinPhoneWithCountryCode(nextCountryCode, phoneParts.nationalNumber),
    );
  };

  const handleNumberChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange?.(
      joinPhoneWithCountryCode(selectedCountryCode, event.target.value),
    );
  };

  return (
    <Space.Compact block className="phone-country-input">
      <Select
        id={countrySelectId}
        showSearch={false}
        aria-label="Ölkə telefon kodu"
        disabled={disabled}
        value={selectedCountryCode}
        options={COUNTRY_PHONE_OPTIONS}
        optionFilterProp="label"
        onChange={handleCountryChange}
        style={{ width: 122 }}
      />

      <Input
        id={inputId}
        name={inputId}
        aria-label={placeholder}
        disabled={disabled}
        value={phoneParts.nationalNumber}
        onChange={handleNumberChange}
        placeholder={placeholder}
        inputMode="tel"
        autoComplete="tel"
        maxLength={maxLength}
      />
    </Space.Compact>
  );
}