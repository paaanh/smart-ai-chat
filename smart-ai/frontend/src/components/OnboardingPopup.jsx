import React, { useState } from 'react';
import './OnboardingPopup.css';

const steps = [
  {
    title: 'Chào mừng bạn đến với Smart Chat!',
    content: 'Đây là ứng dụng chat thông minh với nhiều tính năng hiện đại. Nhấn Tiếp tục để xem hướng dẫn.'
  },
  {
    title: 'Giao diện chính',
    content: 'Bạn có thể gửi tin nhắn, file, hình ảnh, và sử dụng emoji, reaction, trả lời nhanh...'
  },
  {
    title: 'Tùy chỉnh giao diện',
    content: 'Chọn theme, đổi avatar, quản lý phòng chat dễ dàng.'
  },
  {
    title: 'Chúc bạn trải nghiệm vui vẻ!',
    content: 'Nếu cần trợ giúp, hãy nhấn vào biểu tượng trợ giúp ở góc màn hình.'
  }
];

export default function OnboardingPopup({ onClose }) {
  const [step, setStep] = useState(0);
  const current = step + 1;
  const total = steps.length;

  const next = () => {
    if (step < steps.length - 1) setStep(step + 1);
    else onClose();
  };
  const prev = () => {
    if (step > 0) setStep(step - 1);
  };

  return (
    <div className="onboarding-popup-overlay">
      <div className="onboarding-popup">
        <p className="onboarding-step-indicator">Bước {current}/{total}</p>
        <h2>{steps[step].title}</h2>
        <p>{steps[step].content}</p>
        <div className="onboarding-dots" aria-hidden="true">
          {steps.map((_, idx) => (
            <span key={idx} className={idx === step ? 'dot active' : 'dot'} />
          ))}
        </div>
        <div className="onboarding-popup-actions">
          <button type="button" className="ghost" onClick={onClose}>Bỏ qua</button>
          {step > 0 && <button onClick={prev}>Quay lại</button>}
          <button onClick={next}>{step === steps.length - 1 ? 'Kết thúc' : 'Tiếp tục'}</button>
        </div>
      </div>
    </div>
  );
}
