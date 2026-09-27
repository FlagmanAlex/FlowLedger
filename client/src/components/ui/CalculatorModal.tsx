import { useState } from 'react';
import { roundMoney } from '@/lib/format';
import './CalculatorModal.css';

interface CalculatorModalProps {
  /** Текущее значение поля — калькулятор открывается с ним, чтобы можно было
   *  сразу прибавить/умножить к тому, что уже введено, а не начинать с нуля. */
  initialValue?: string;
  onApply: (value: string) => void;
  onClose: () => void;
}

type Operator = '+' | '−' | '×' | '÷';

function applyOperator(a: number, b: number, op: Operator): number {
  switch (op) {
    case '+':
      return a + b;
    case '−':
      return a - b;
    case '×':
      return a * b;
    case '÷':
      return b !== 0 ? a / b : NaN;
  }
}

/** Округляем промежуточные результаты как денежные суммы — иначе плавающая
 *  погрешность (0.1+0.2 и т.п.) вылезала бы прямо в поле суммы. */
function formatResult(value: number): string {
  if (!Number.isFinite(value)) return '0';
  return String(roundMoney(value));
}

export function CalculatorModal({ initialValue, onApply, onClose }: CalculatorModalProps) {
  const initial = Number((initialValue ?? '').replace(',', '.'));
  const [display, setDisplay] = useState(Number.isFinite(initial) && initial !== 0 ? String(initial) : '0');
  const [accumulator, setAccumulator] = useState<number | null>(null);
  const [operator, setOperator] = useState<Operator | null>(null);
  const [overwrite, setOverwrite] = useState(true);

  function pressDigit(digit: string) {
    if (overwrite) {
      setDisplay(digit);
      setOverwrite(false);
      return;
    }
    setDisplay(display === '0' ? digit : display + digit);
  }

  function pressDot() {
    if (overwrite) {
      setDisplay('0.');
      setOverwrite(false);
      return;
    }
    if (!display.includes('.')) setDisplay(display + '.');
  }

  function pressOperator(op: Operator) {
    const current = Number(display);
    if (accumulator !== null && operator && !overwrite) {
      const result = applyOperator(accumulator, current, operator);
      setAccumulator(result);
      setDisplay(formatResult(result));
    } else {
      setAccumulator(current);
    }
    setOperator(op);
    setOverwrite(true);
  }

  function pressEquals() {
    if (operator === null || accumulator === null) return;
    const result = applyOperator(accumulator, Number(display), operator);
    setDisplay(formatResult(result));
    setAccumulator(null);
    setOperator(null);
    setOverwrite(true);
  }

  function pressClear() {
    setDisplay('0');
    setAccumulator(null);
    setOperator(null);
    setOverwrite(true);
  }

  function pressBackspace() {
    if (overwrite) return;
    const next = display.length > 1 ? display.slice(0, -1) : '0';
    setDisplay(next === '-' ? '0' : next);
  }

  function pressPercent() {
    setDisplay(formatResult(Number(display) / 100));
  }

  function handleApply() {
    const result =
      operator !== null && accumulator !== null ? applyOperator(accumulator, Number(display), operator) : Number(display);
    onApply(formatResult(result));
    onClose();
  }

  return (
    // Калькулятор открывается поверх другого модального окна (сумма в форме
    //  операции/перевода/долга) — клик по фону должен закрыть только его, а
    //  не всплыть до onClick фона того окна, под которым он вложен в DOM.
    <div
      className="modal-overlay"
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      <div className="modal-sheet calculator-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-sheet__header">
          <button type="button" className="neo-button neo-button--icon" onClick={onClose}>
            ✕
          </button>
          <span className="modal-sheet__title">Калькулятор</span>
          <span style={{ width: 44 }} />
        </div>

        <div className="calculator-modal__display">{display.replace('.', ',')}</div>

        <div className="calculator-modal__grid">
          <button
            type="button"
            className="neo-button calculator-modal__key calculator-modal__key--muted"
            onClick={pressClear}
          >
            C
          </button>
          <button
            type="button"
            className="neo-button calculator-modal__key calculator-modal__key--muted"
            onClick={pressBackspace}
          >
            ⌫
          </button>
          <button
            type="button"
            className="neo-button calculator-modal__key calculator-modal__key--muted"
            onClick={pressPercent}
          >
            %
          </button>
          <button
            type="button"
            className="neo-button calculator-modal__key calculator-modal__key--op"
            onClick={() => pressOperator('÷')}
          >
            ÷
          </button>

          <button type="button" className="neo-button calculator-modal__key" onClick={() => pressDigit('7')}>
            7
          </button>
          <button type="button" className="neo-button calculator-modal__key" onClick={() => pressDigit('8')}>
            8
          </button>
          <button type="button" className="neo-button calculator-modal__key" onClick={() => pressDigit('9')}>
            9
          </button>
          <button
            type="button"
            className="neo-button calculator-modal__key calculator-modal__key--op"
            onClick={() => pressOperator('×')}
          >
            ×
          </button>

          <button type="button" className="neo-button calculator-modal__key" onClick={() => pressDigit('4')}>
            4
          </button>
          <button type="button" className="neo-button calculator-modal__key" onClick={() => pressDigit('5')}>
            5
          </button>
          <button type="button" className="neo-button calculator-modal__key" onClick={() => pressDigit('6')}>
            6
          </button>
          <button
            type="button"
            className="neo-button calculator-modal__key calculator-modal__key--op"
            onClick={() => pressOperator('−')}
          >
            −
          </button>

          <button type="button" className="neo-button calculator-modal__key" onClick={() => pressDigit('1')}>
            1
          </button>
          <button type="button" className="neo-button calculator-modal__key" onClick={() => pressDigit('2')}>
            2
          </button>
          <button type="button" className="neo-button calculator-modal__key" onClick={() => pressDigit('3')}>
            3
          </button>
          <button
            type="button"
            className="neo-button calculator-modal__key calculator-modal__key--op"
            onClick={() => pressOperator('+')}
          >
            +
          </button>

          <button
            type="button"
            className="neo-button calculator-modal__key calculator-modal__key--zero"
            onClick={() => pressDigit('0')}
          >
            0
          </button>
          <button type="button" className="neo-button calculator-modal__key" onClick={pressDot}>
            ,
          </button>
          <button type="button" className="neo-button neo-button--accent calculator-modal__key" onClick={pressEquals}>
            =
          </button>
        </div>

        <button type="button" className="neo-button neo-button--accent neo-button--full" onClick={handleApply}>
          Подставить
        </button>
      </div>
    </div>
  );
}
