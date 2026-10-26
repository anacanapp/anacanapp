import * as React from "react";
import { tr } from '@/lib/tr';
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Calendar, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { getCurrentDateLocale } from '@/lib/date-utils';

interface DatePickerWheelProps {
  value?: Date;
  onChange: (date: Date | undefined) => void;
  minYear?: number;
  maxYear?: number;
  disabled?: (date: Date) => boolean;
  placeholder?: string;
  className?: string;
}

// Months are localized inside the component dynamically


const getDaysInMonth = (year: number, month: number) => {
  return new Date(year, month + 1, 0).getDate();
};

export function DatePickerWheel({
  value,
  onChange,
  minYear = 1940,
  maxYear = new Date().getFullYear(),
  disabled,
  placeholder = tr("datepickerwheel_tarix_secin_3377b4", "Tarix se\xE7in"),
  className
}: DatePickerWheelProps) {
  const months = [
    tr("month_january", "Yanvar"),
    tr("month_february", "Fevral"),
    tr("month_march", "Mart"),
    tr("month_april", "Aprel"),
    tr("month_may", "May"),
    tr("month_june", "İyun"),
    tr("month_july", "İyul"),
    tr("month_august", "Avqust"),
    tr("month_september", "Sentyabr"),
    tr("month_october", "Oktyabr"),
    tr("month_november", "Noyabr"),
    tr("month_december", "Dekabr")
  ];
  const [isOpen, setIsOpen] = React.useState(false);
  const [view, setView] = React.useState<'calendar' | 'year' | 'month'>('calendar');
  const [displayYear, setDisplayYear] = React.useState(value?.getFullYear() || 1990);
  const [displayMonth, setDisplayMonth] = React.useState(value?.getMonth() || 0);
  const [selectedDate, setSelectedDate] = React.useState<Date | undefined>(value);
  const [yearPage, setYearPage] = React.useState(0);

  React.useEffect(() => {
    if (value) {
      setDisplayYear(value.getFullYear());
      setDisplayMonth(value.getMonth());
      setSelectedDate(value);
    }
  }, [value]);

  const years = React.useMemo(() => {
    const allYears = [];
    for (let y = maxYear; y >= minYear; y--) {
      allYears.push(y);
    }
    return allYears;
  }, [minYear, maxYear]);

  const yearsPerPage = 16;
  const totalYearPages = Math.ceil(years.length / yearsPerPage);
  const visibleYears = years.slice(yearPage * yearsPerPage, (yearPage + 1) * yearsPerPage);

  const handleSelectDay = (day: number) => {
    const newDate = new Date(displayYear, displayMonth, day);
    if (disabled && disabled(newDate)) return;
    setSelectedDate(newDate);
    onChange(newDate);
    setIsOpen(false);
  };

  const handlePrevMonth = () => {
    if (displayMonth === 0) {
      setDisplayMonth(11);
      setDisplayYear((prev) => prev - 1);
    } else {
      setDisplayMonth((prev) => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (displayMonth === 11) {
      setDisplayMonth(0);
      setDisplayYear((prev) => prev + 1);
    } else {
      setDisplayMonth((prev) => prev + 1);
    }
  };

  const handleSelectYear = (year: number) => {
    setDisplayYear(year);
    setView('month');
  };

  const handleSelectMonth = (month: number) => {
    setDisplayMonth(month);
    setView('calendar');
  };

  const daysInCurrentMonth = getDaysInMonth(displayYear, displayMonth);
  const firstDayOfMonth = new Date(displayYear, displayMonth, 1).getDay();
  const adjustedFirstDay = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;

  const weekDays = [
    tr("datepickerwheel_mon", "Baz.e."),
    tr("datepickerwheel_c_ax_6cdba6", "Ç.ax."),
    tr("datepickerwheel_cer_879279", "Çər."),
    tr("datepickerwheel_thu", "C.ax."),
    tr("datepickerwheel_cum_a58b1a", "Cüm."),
    tr("datepickerwheel_sen_60edd8", "Şən."),
    tr("datepickerwheel_sun", "Baz.")
  ];

  const renderCalendarView = () =>
  <motion.div
    key="calendar"
    initial={{ opacity: 0, scale: 0.95 }}
    animate={{ opacity: 1, scale: 1 }}
    exit={{ opacity: 0, scale: 0.95 }}
    className="space-y-3">
    
      {/* Header with month/year selection */}
      <div className="flex items-center justify-between">
        <Button
        variant="ghost"
        size="icon"
        onClick={handlePrevMonth}
        className="h-9 w-9 rounded-full">
        
          <ChevronLeft className="rtl:rotate-180 h-4 w-4" />
        </Button>

        <div className="flex items-center gap-2">
          <Button
          variant="ghost"
          onClick={() => setView('month')}
          className="font-semibold text-base px-3 h-9 rounded-xl hover:bg-primary/10">
          
            {months[displayMonth]}
          </Button>
          <Button
          variant="ghost"
          onClick={() => setView('year')}
          className="font-semibold text-base px-3 h-9 rounded-xl hover:bg-primary/10">
          
            {displayYear}
          </Button>
        </div>

        <Button
        variant="ghost"
        size="icon"
        onClick={handleNextMonth}
        className="h-9 w-9 rounded-full">
        
          <ChevronRight className="rtl:rotate-180 h-4 w-4" />
        </Button>
      </div>

      {/* Week days header */}
      <div className="grid grid-cols-7 gap-1">
        {weekDays.map((day) =>
      <div
        key={day}
        className="text-center text-xs font-medium text-muted-foreground py-2">
        
            {day}
          </div>
      )}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {/* Empty cells for days before the first day */}
        {Array.from({ length: adjustedFirstDay }).map((_, i) =>
      <div key={`empty-${i}`} className="aspect-square" />
      )}

        {/* Day cells */}
        {Array.from({ length: daysInCurrentMonth }).map((_, i) => {
        const day = i + 1;
        const currentDate = new Date(displayYear, displayMonth, day);
        const isSelected =
        selectedDate?.getDate() === day &&
        selectedDate?.getMonth() === displayMonth &&
        selectedDate?.getFullYear() === displayYear;
        const isToday =
        new Date().getDate() === day &&
        new Date().getMonth() === displayMonth &&
        new Date().getFullYear() === displayYear;
        const isDisabled = disabled && disabled(currentDate);

        return (
          <motion.button
            key={day}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => handleSelectDay(day)}
            disabled={isDisabled}
            className={cn(
              "w-full aspect-square rounded-full text-sm font-medium transition-all",
              "flex items-center justify-center",
              isSelected ?
              "bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-lg shadow-primary/30" :
              isToday ?
              "ring-2 ring-primary/50 bg-primary/10" :
              "hover:bg-muted",
              isDisabled && "opacity-30 cursor-not-allowed"
            )}>
            
              {day}
            </motion.button>);

      })}
      </div>
    </motion.div>;


  const renderYearView = () =>
  <motion.div
    key="year"
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -20 }}
    className="space-y-3">
    
      <div className="flex items-center justify-between mb-2">
        <Button
        variant="ghost"
        size="icon"
        onClick={() => setYearPage((prev) => Math.max(0, prev - 1))}
        disabled={yearPage === 0}
        className="h-9 w-9 rounded-full">
        
          <ChevronLeft className="rtl:rotate-180 h-4 w-4" />
        </Button>

        <span className="font-semibold text-sm text-muted-foreground">
          {tr("datepickerwheel_i_l_secin_5fe2b5", "\u0130l se\xE7in")}
        </span>

        <Button
        variant="ghost"
        size="icon"
        onClick={() => setYearPage((prev) => Math.min(totalYearPages - 1, prev + 1))}
        disabled={yearPage >= totalYearPages - 1}
        className="h-9 w-9 rounded-full">
        
          <ChevronRight className="rtl:rotate-180 h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {visibleYears.map((year) =>
      <motion.button
        key={year}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => handleSelectYear(year)}
        className={cn(
          "py-3 rounded-xl text-sm font-medium transition-all",
          year === displayYear ?
          "bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-lg shadow-primary/30" :
          "bg-muted/50 hover:bg-muted"
        )}>
        
            {year}
          </motion.button>
      )}
      </div>
    </motion.div>;


  const renderMonthView = () =>
  <motion.div
    key="month"
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -20 }}
    className="space-y-3">
    
      <div className="text-center mb-2">
        <Button
        variant="ghost"
        onClick={() => setView('year')}
        className="font-semibold text-base">
        
          {displayYear}
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {months.map((month, i) =>
      <motion.button
        key={month}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => handleSelectMonth(i)}
        className={cn(
          "py-4 rounded-xl text-sm font-medium transition-all",
          i === displayMonth && displayYear === value?.getFullYear() ?
          "bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-lg shadow-primary/30" :
          "bg-muted/50 hover:bg-muted"
        )}>
        
            {month}
          </motion.button>
      )}
      </div>
    </motion.div>;


  return (
    <div className="relative">
      {/* Trigger Button */}
      <Button
        type="button"
        variant="outline"
        onClick={() => setIsOpen(true)}
        className={cn(
          "w-full h-14 justify-start text-start font-normal rounded-2xl border-2",
          "bg-gradient-to-br from-muted/30 to-muted/50",
          "hover:border-primary/50 hover:bg-muted/60 transition-all",
          !value && "text-muted-foreground",
          className
        )}>
        
        <div className="flex items-center gap-3 flex-1">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
            <Calendar className="h-5 w-5 text-primary" />
          </div>
          <div className="flex flex-col items-start">
            <span className="text-xs text-muted-foreground">{tr("date-picker-wheel_dogum_tarixi_d96907", "Doğum tarixi")}</span>
            <span className={cn("font-medium", value ? "text-foreground" : "text-muted-foreground")}>
              {value ? format(value, "d MMMM yyyy", { locale: getCurrentDateLocale() }) : placeholder}
            </span>
          </div>
        </div>
        {value &&
        <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center">
            <Check className="h-4 w-4 text-green-600" />
          </div>
        }
      </Button>

      {/* Modal Backdrop */}
      <AnimatePresence>
        {isOpen &&
        <>
            <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 bg-black/50 z-50" />
          
            <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-50 mx-auto max-w-sm">
            
              <div className="bg-background rounded-3xl shadow-2xl border overflow-hidden">
                {/* Modal Header */}
                <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-4 flex items-center justify-between border-b">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
                      <Calendar className="h-4 w-4 text-primary" />
                    </div>
                    <span className="font-semibold">{tr("date-picker-wheel_tarix_secin_3377b4", "Tarix seçin")}</span>
                  </div>
                  <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsOpen(false)}
                  className="h-8 w-8 rounded-full">
                  
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                {/* Modal Content */}
                <div className="p-4">
                  <AnimatePresence mode="wait">
                    {view === 'calendar' && renderCalendarView()}
                    {view === 'year' && renderYearView()}
                    {view === 'month' && renderMonthView()}
                  </AnimatePresence>
                </div>

                {/* Quick Actions */}
                <div className="p-4 border-t bg-muted/30 flex gap-2">
                  <Button
                  variant="outline"
                  className="flex-1 rounded-xl h-11"
                  onClick={() => {
                    setSelectedDate(undefined);
                    onChange(undefined);
                    setIsOpen(false);
                  }}>
                    {tr("datepickerwheel_temizle_1c3651", "T\u0259mizl\u0259")}
                  
                </Button>
                  <Button
                  variant="ghost"
                  className="flex-1 rounded-xl h-11 text-primary"
                  onClick={() => {
                    const today = new Date();
                    setDisplayYear(today.getFullYear());
                    setDisplayMonth(today.getMonth());
                    setView('calendar');
                  }}>
                    {tr("datepickerwheel_bu_gun_786fd4", "Bu g\xFCn")}
                  
                </Button>
                </div>
              </div>
            </motion.div>
          </>
        }
      </AnimatePresence>
    </div>);

}