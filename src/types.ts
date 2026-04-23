export type ScreenId = 
  | 'privacy' 
  | 'auth-phone' 
  | 'welcome' 
  | 'input' 
  | 'protocol'
  | 'generating'
  | 'history'
  | 'answer'
  | 'delete-confirm'
  | 'session-detail'
  | 'delete-done'
  | 'feedback';

export type TransitionType = 'push' | 'push_back' | 'slide_up' | 'none';

export interface NavigationState {
  currentScreen: ScreenId;
  history: ScreenId[];
  transition: TransitionType;
}
