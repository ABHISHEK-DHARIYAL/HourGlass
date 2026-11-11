// Purpose: Interactive notification settings panel within settings view

import React from 'react';
import { NotificationSettings } from '../utils/notificationService';
import { 
  Bell, 
  BellOff, 
  ShieldAlert, 
  Volume2, 
  VolumeX, 
  Zap, 
  Clock, 
  Sparkles, 
  Coffee, 
  Calendar, 
  Moon as MoonStar, 
  Activity 
} from 'lucide-react';

interface NotificationSettingsPanelProps {
  isSubscribed: boolean;
  pushSupported: boolean;
  permissionStatus: string;
  loading: boolean;
  notifSettings: NotificationSettings;
  handleSubscribe: () => Promise<void>;
  handleUnsubscribe: () => Promise<void>;
  handleUpdateNotifSetting: (key: keyof NotificationSettings, value: any) => Promise<void>;
}

export default function NotificationSettingsPanel({
  isSubscribed,
  pushSupported,
  permissionStatus,
  loading,
  notifSettings,
  handleSubscribe,
  handleUnsubscribe,
  handleUpdateNotifSetting,
}: NotificationSettingsPanelProps) {
  return (
    <div className="flex items-start gap-3.5 pt-2">
      <div className={`p-2 rounded-lg mt-0.5 ${isSubscribed ? 'bg-ledger-coral/15 text-ledger-coral' : 'bg-ledger-slate-light text-ledger-paper-dim'}`}>
        {isSubscribed ? <Bell className="w-5 h-5" /> : <BellOff className="w-5 h-5" />}
      </div>
      <div className="flex-1">
        <div className="text-sm font-semibold text-ledger-paper flex items-center gap-1.5">
          <span>Push Notifications</span>
          {isSubscribed && (
            <span className="text-[9px] bg-ledger-coral/12 text-ledger-coral px-1.5 py-0.5 rounded-full uppercase tracking-wider font-bold">
              Active
            </span>
          )}
        </div>
        
        <p className="text-[11px] text-ledger-paper-dim mt-1 leading-relaxed">
          Triggers a system-level notification at the exact start of your booked hours. Runs even when the app is completely closed.
        </p>

        {pushSupported ? (
          <div className="mt-4">
            <button
              onClick={isSubscribed ? handleUnsubscribe : handleSubscribe}
              disabled={loading}
              id="push-subscription-toggle-button"
              className={`w-full h-10 px-4 rounded-xl font-sans font-bold text-xs transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-2 shadow-sm ${
                isSubscribed
                  ? 'bg-ledger-slate-light hover:bg-ledger-slate-light/95 text-ledger-coral border border-ledger-line'
                  : 'bg-ledger-coral hover:bg-ledger-coral/95 text-ledger-dark'
              }`}
            >
              {loading ? (
                <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></span>
              ) : isSubscribed ? (
                <>
                  <BellOff className="w-4 h-4" />
                  <span>Disable Push Alerts</span>
                </>
              ) : (
                <>
                  <Bell className="w-4 h-4" />
                  <span>Enable System Push Alerts</span>
                </>
              )}
            </button>

            <div className="mt-5 border-t border-ledger-line/40 pt-4 space-y-4 animate-in fade-in duration-350">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-ledger-paper uppercase tracking-wider flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-ledger-coral" />
                    <span>Interactive Engine Settings</span>
                  </h4>
                  <p className="text-[10px] text-ledger-paper-dim/60 mt-0.5">
                    Configure client & background alert properties
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleUpdateNotifSetting('enabled', !notifSettings.enabled)}
                  id="master-notification-switch"
                  className={`w-10 h-5 rounded-full p-0.5 transition-colors cursor-pointer flex items-center ${
                    notifSettings.enabled ? 'bg-ledger-coral justify-end' : 'bg-ledger-slate-light justify-start border border-ledger-line'
                  }`}
                >
                  <span className="w-4 h-4 rounded-full bg-white shadow-sm" />
                </button>
              </div>

              {notifSettings.enabled && (
                <div className="space-y-3.5 pl-1.5 animate-in fade-in slide-in-from-top-1.5 duration-200">
                  
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2.5 surface-panel rounded-xl flex items-center justify-between gap-2">
                      <span className="text-[11px] font-semibold text-ledger-paper-dim flex items-center gap-1.5">
                        {notifSettings.soundEnabled ? <Volume2 className="w-3.5 h-3.5 text-ledger-coral" /> : <VolumeX className="w-3.5 h-3.5 text-ledger-paper-dim/50" />}
                        <span>Audio Chimes</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => handleUpdateNotifSetting('soundEnabled', !notifSettings.soundEnabled)}
                        id="sound-alert-switch"
                        className={`w-8 h-4.5 rounded-full p-0.5 transition-colors cursor-pointer flex items-center ${
                          notifSettings.soundEnabled ? 'bg-ledger-coral justify-end' : 'bg-ledger-slate-light justify-start border border-ledger-line'
                        }`}
                      >
                        <span className="w-3 h-3 rounded-full bg-white" />
                      </button>
                    </div>

                    <div className="p-2.5 surface-panel rounded-xl flex items-center justify-between gap-2">
                      <span className="text-[11px] font-semibold text-ledger-paper-dim flex items-center gap-1.5">
                        <Zap className="w-3.5 h-3.5 text-ledger-coral" />
                        <span>Vibrations</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => handleUpdateNotifSetting('vibrationEnabled', !notifSettings.vibrationEnabled)}
                        id="vibrate-switch"
                        className={`w-8 h-4.5 rounded-full p-0.5 transition-colors cursor-pointer flex items-center ${
                          notifSettings.vibrationEnabled ? 'bg-ledger-coral justify-end' : 'bg-ledger-slate-light justify-start border border-ledger-line'
                        }`}
                      >
                        <span className="w-3 h-3 rounded-full bg-white" />
                      </button>
                    </div>
                  </div>

                  <div className="p-2.5 surface-panel rounded-xl flex items-center justify-between gap-3">
                    <div className="flex-1">
                      <div className="text-[11px] font-semibold text-ledger-paper flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-ledger-coral" />
                        <span>Upcoming Reminders</span>
                      </div>
                      <p className="text-[9px] text-ledger-paper-dim/60">
                        Pre-alert offset timing prior to task start
                      </p>
                    </div>
                    <select
                      value={notifSettings.reminderTiming}
                      onChange={(e) => handleUpdateNotifSetting('reminderTiming', parseInt(e.target.value, 10))}
                      className="bg-ledger-dark border border-ledger-line text-ledger-paper text-[10px] rounded-lg px-2 py-1 focus:outline-none focus:border-ledger-coral font-mono"
                    >
                      <option value="5">5 Minutes</option>
                      <option value="10">10 Minutes</option>
                      <option value="15">15 Minutes</option>
                      <option value="30">30 Minutes</option>
                    </select>
                  </div>

                  <div className="p-3 surface-panel rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-ledger-paper flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-ledger-coral" />
                        <span>Morning Briefing</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => handleUpdateNotifSetting('morningSummaryEnabled', !notifSettings.morningSummaryEnabled)}
                        id="morning-summary-switch"
                        className={`w-8 h-4.5 rounded-full p-0.5 transition-colors cursor-pointer flex items-center ${
                          notifSettings.morningSummaryEnabled ? 'bg-ledger-coral justify-end' : 'bg-ledger-slate-light justify-start border border-ledger-line'
                        }`}
                      >
                        <span className="w-3 h-3 rounded-full bg-white" />
                      </button>
                    </div>
                    {notifSettings.morningSummaryEnabled && (
                      <div className="flex items-center justify-between pl-5 pt-1 animate-in fade-in duration-150">
                        <span className="text-[9px] text-ledger-paper-dim/60 font-medium">Daily Delivery Time</span>
                        <input
                          type="time"
                          value={notifSettings.morningSummaryTime}
                          onChange={(e) => handleUpdateNotifSetting('morningSummaryTime', e.target.value)}
                          className="bg-ledger-dark border border-ledger-line text-ledger-paper text-[10px] rounded-lg px-2 py-1 focus:outline-none focus:border-ledger-coral font-mono"
                        />
                      </div>
                    )}
                  </div>

                  <div className="p-3 surface-panel rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-ledger-paper flex items-center gap-1.5">
                        <MoonStar className="w-3.5 h-3.5 text-ledger-coral" />
                        <span>Evening Briefing</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => handleUpdateNotifSetting('eveningSummaryEnabled', !notifSettings.eveningSummaryEnabled)}
                        id="evening-summary-switch"
                        className={`w-8 h-4.5 rounded-full p-0.5 transition-colors cursor-pointer flex items-center ${
                          notifSettings.eveningSummaryEnabled ? 'bg-ledger-coral justify-end' : 'bg-ledger-slate-light justify-start border border-ledger-line'
                        }`}
                      >
                        <span className="w-3 h-3 rounded-full bg-white" />
                      </button>
                    </div>
                    {notifSettings.eveningSummaryEnabled && (
                      <div className="flex items-center justify-between pl-5 pt-1 animate-in fade-in duration-150">
                        <span className="text-[9px] text-ledger-paper-dim/60 font-medium">Daily Delivery Time</span>
                        <input
                          type="time"
                          value={notifSettings.eveningSummaryTime}
                          onChange={(e) => handleUpdateNotifSetting('eveningSummaryTime', e.target.value)}
                          className="bg-ledger-dark border border-ledger-line text-ledger-paper text-[10px] rounded-lg px-2 py-1 focus:outline-none focus:border-ledger-coral font-mono"
                        />
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-2">
                    <div className="p-2.5 surface-panel rounded-xl flex items-center justify-between">
                      <div className="flex-1">
                        <div className="text-[11px] font-semibold text-ledger-paper flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-ledger-coral" />
                          <span>Habit Alerts</span>
                        </div>
                        <p className="text-[9px] text-ledger-paper-dim/60">
                          Notify if daily habits are pending
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleUpdateNotifSetting('habitRemindersEnabled', !notifSettings.habitRemindersEnabled)}
                        id="habit-alerts-switch"
                        className={`w-8 h-4.5 rounded-full p-0.5 transition-colors cursor-pointer flex items-center ${
                          notifSettings.habitRemindersEnabled ? 'bg-ledger-coral justify-end' : 'bg-ledger-slate-light justify-start border border-ledger-line'
                        }`}
                      >
                        <span className="w-3 h-3 rounded-full bg-white" />
                      </button>
                    </div>

                    <div className="p-3 surface-panel rounded-xl space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="text-[11px] font-semibold text-ledger-paper flex items-center gap-1.5">
                            <Coffee className="w-3.5 h-3.5 text-ledger-coral" />
                            <span>Smart Break Advice</span>
                          </div>
                          <p className="text-[9px] text-ledger-paper-dim/60">
                            Suggest stretch breaks during deep focus
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleUpdateNotifSetting('breakRemindersEnabled', !notifSettings.breakRemindersEnabled)}
                          id="break-reminders-switch"
                          className={`w-8 h-4.5 rounded-full p-0.5 transition-colors cursor-pointer flex items-center ${
                            notifSettings.breakRemindersEnabled ? 'bg-ledger-coral justify-end' : 'bg-ledger-slate-light justify-start border border-ledger-line'
                          }`}
                        >
                          <span className="w-3 h-3 rounded-full bg-white" />
                        </button>
                      </div>
                      {notifSettings.breakRemindersEnabled && (
                        <div className="flex items-center justify-between pl-5 pt-1 animate-in fade-in duration-150">
                          <span className="text-[9px] text-ledger-paper-dim/60 font-medium">Interval Threshold</span>
                          <select
                            value={notifSettings.breakIntervalMinutes}
                            onChange={(e) => handleUpdateNotifSetting('breakIntervalMinutes', parseInt(e.target.value, 10))}
                            className="bg-ledger-dark border border-ledger-line text-ledger-paper text-[10px] rounded-lg px-2 py-1 focus:outline-none focus:border-ledger-coral font-mono"
                          >
                            <option value="30">30 minutes</option>
                            <option value="45">45 minutes</option>
                            <option value="60">60 minutes</option>
                            <option value="90">90 minutes</option>
                          </select>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="p-3 surface-panel rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-[11px] font-semibold text-ledger-paper flex items-center gap-1.5">
                          <MoonStar className="w-3.5 h-3.5 text-ledger-coral" />
                          <span>Quiet Hours</span>
                        </span>
                        <p className="text-[9px] text-ledger-paper-dim/60">
                          Suppress alerts during specific hours
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleUpdateNotifSetting('quietHoursEnabled', !notifSettings.quietHoursEnabled)}
                        id="quiet-hours-switch"
                        className={`w-8 h-4.5 rounded-full p-0.5 transition-colors cursor-pointer flex items-center ${
                          notifSettings.quietHoursEnabled ? 'bg-ledger-coral justify-end' : 'bg-ledger-slate-light justify-start border border-ledger-line'
                        }`}
                      >
                        <span className="w-3 h-3 rounded-full bg-white" />
                      </button>
                    </div>
                    {notifSettings.quietHoursEnabled && (
                      <div className="grid grid-cols-2 gap-3 pl-5 pt-1.5 animate-in fade-in duration-150">
                        <div className="flex flex-col gap-1">
                          <span className="text-[8px] text-ledger-paper-dim/60 uppercase font-bold">Start</span>
                          <input
                            type="time"
                            value={notifSettings.quietHoursStart}
                            onChange={(e) => handleUpdateNotifSetting('quietHoursStart', e.target.value)}
                            className="bg-ledger-dark border border-ledger-line text-ledger-paper text-[10px] rounded-lg px-2 py-1 focus:outline-none focus:border-ledger-coral font-mono w-full"
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-[8px] text-ledger-paper-dim/60 uppercase font-bold">End</span>
                          <input
                            type="time"
                            value={notifSettings.quietHoursEnd}
                            onChange={(e) => handleUpdateNotifSetting('quietHoursEnd', e.target.value)}
                            className="bg-ledger-dark border border-ledger-line text-ledger-paper text-[10px] rounded-lg px-2 py-1 focus:outline-none focus:border-ledger-coral font-mono w-full"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                </div>
              )}
            </div>

            {permissionStatus === 'denied' && (
              <div className="mt-3 p-3 rounded-xl bg-ledger-coral/10 border border-ledger-coral/20 text-ledger-paper-dim text-[11px] flex flex-col gap-1.5">
                <div className="flex items-center gap-2 font-semibold text-ledger-coral">
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                  <span>Notification Access Blocked</span>
                </div>
                <p className="leading-relaxed">
                  {window.self !== window.top ? (
                    <>
                      Because this app is running inside an iframe, standard browser push notifications are restricted. Please <strong className="text-ledger-paper font-semibold">open the application in a new tab</strong> (using the button in the top-right corner of the window) to allow and receive notifications.
                    </>
                  ) : (
                    <>
                      Notifications are blocked in your browser settings. Please click the lock or settings icon next to the URL in your browser's address bar and set "Notifications" to <strong className="text-ledger-paper font-semibold">Allow</strong>.
                    </>
                  )}
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="mt-3 p-3 rounded-lg bg-ledger-coral/10 border border-ledger-coral/20 text-ledger-paper-dim text-[10px] flex gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0 text-ledger-coral" />
            <span>
              Push Notifications are not supported in this browser environment. Try opening on Google Chrome, Firefox, or Safari on Mobile.
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
