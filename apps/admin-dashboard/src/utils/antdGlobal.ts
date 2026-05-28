import type { MessageInstance } from 'antd/es/message/interface';
import type { NotificationInstance } from 'antd/es/notification/interface';
import type { ModalStaticFunctions } from 'antd/es/modal/confirm';

let message: MessageInstance = {
  info: () => ({}) as any,
  success: () => ({}) as any,
  error: () => ({}) as any,
  warning: () => ({}) as any,
  loading: () => ({}) as any,
  open: () => ({}) as any,
  destroy: () => {},
};

let notification: NotificationInstance;
let modal: Omit<ModalStaticFunctions, 'warn'>;

export function setGlobalAntd({
  message: msg,
  notification: notif,
  modal: mdl,
}: {
  message: MessageInstance;
  notification: NotificationInstance;
  modal: Omit<ModalStaticFunctions, 'warn'>;
}) {
  message = msg;
  notification = notif;
  modal = mdl;
}

export { message, notification, modal };
