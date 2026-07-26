import { Buffer } from 'buffer';
import process from 'process';

if (typeof window !== 'undefined') {
  (window as any).global = window;
  (window as any).process = process;
  (window as any).Buffer = Buffer;
}
