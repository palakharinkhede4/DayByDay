//
//  HabitLiveActivityWidget.swift
//  DayByDay
//
//  SwiftUI Widget implementing iOS ActivityKit Dynamic Island and Lock Screen presentations
//

import ActivityKit
import SwiftUI
import WidgetKit

@available(iOS 16.1, *)
public struct HabitLiveActivityWidget: Widget {
    public init() {}

    public var body: some WidgetConfiguration {
        ActivityConfiguration(for: HabitActivityAttributes.self) { context in
            // MARK: - Lock Screen & Banner Presentation
            HabitLockScreenLiveActivityView(attributes: context.attributes, state: context.state)
                .activityBackgroundTint(Color.black.opacity(0.85))
                .activitySystemActionForegroundColor(Color.white)
        } dynamicIsland: { context in
            // MARK: - Dynamic Island Presentations
            DynamicIsland {
                // Expanded Leading
                DynamicIslandExpandedRegion(.leading) {
                    HStack(spacing: 8) {
                        Text(context.attributes.icon)
                            .font(.system(size: 22))
                            .padding(6)
                            .background(Color.white.opacity(0.12))
                            .clipShape(Circle())
                        
                        VStack(alignment: .leading, spacing: 2) {
                            Text(context.attributes.habitName)
                                .font(.system(size: 15, weight: .bold))
                                .foregroundColor(.white)
                            Text(context.attributes.category.uppercased())
                                .font(.system(size: 10, weight: .semibold))
                                .foregroundColor(.white.opacity(0.6))
                        }
                    }
                }

                // Expanded Trailing
                DynamicIslandExpandedRegion(.trailing) {
                    VStack(alignment: .trailing, spacing: 2) {
                        HStack(spacing: 3) {
                            Text("🔥")
                                .font(.system(size: 13))
                            Text("\(context.state.streak)d")
                                .font(.system(size: 14, weight: .bold))
                                .foregroundColor(.orange)
                        }
                        Text("\(context.state.podSyncPercent)% Pod")
                            .font(.system(size: 11, weight: .medium))
                            .foregroundColor(.white.opacity(0.7))
                    }
                }

                // Expanded Bottom: Progress meter and 1-tap action hints
                DynamicIslandExpandedRegion(.bottom) {
                    VStack(spacing: 8) {
                        // Progress Bar
                        GeometryReader { geometry in
                            let progress = min(1.0, max(0.0, context.state.targetValue > 0 ? context.state.currentValue / context.state.targetValue : 0.0))
                            ZStack(alignment: .leading) {
                                RoundedRectangle(cornerRadius: 6)
                                    .fill(Color.white.opacity(0.15))
                                    .frame(height: 10)
                                RoundedRectangle(cornerRadius: 6)
                                    .fill(
                                        LinearGradient(
                                            colors: [Color(red: 0.06, green: 0.72, blue: 0.51), Color(red: 0.14, green: 0.78, blue: 0.85)],
                                            startPoint: .leading,
                                            endPoint: .trailing
                                        )
                                    )
                                    .frame(width: geometry.size.width * CGFloat(progress), height: 10)
                            }
                        }
                        .frame(height: 10)

                        // Bottom Info Row
                        HStack {
                            Text("\(formatValue(context.state.currentValue)) / \(formatValue(context.state.targetValue)) \(context.state.unit)")
                                .font(.system(size: 12, weight: .medium))
                                .foregroundColor(.white.opacity(0.85))

                            Spacer()

                            if !context.state.partnerUsername.isEmpty {
                                HStack(spacing: 4) {
                                    Circle()
                                        .fill(context.state.partnerProgressPercent >= 100 ? Color.green : Color.amber)
                                        .frame(width: 6, height: 6)
                                    Text("@\(context.state.partnerUsername): \(context.state.partnerProgressPercent)%")
                                        .font(.system(size: 11, weight: .regular))
                                        .foregroundColor(.white.opacity(0.7))
                                }
                            }
                        }
                    }
                    .padding(.top, 4)
                }
            } compactLeading: {
                // MARK: - Compact Leading (Left Pill)
                HStack(spacing: 4) {
                    Text(context.attributes.icon)
                        .font(.system(size: 13))
                    Text(context.attributes.habitName)
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundColor(.white)
                        .lineLimit(1)
                }
                .padding(.leading, 4)
            } compactTrailing: {
                // MARK: - Compact Trailing (Right Pill)
                HStack(spacing: 3) {
                    let percent = Int((min(1.0, context.state.targetValue > 0 ? context.state.currentValue / context.state.targetValue : 0.0)) * 100)
                    Text("\(percent)%")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundColor(percent >= 100 ? Color.green : Color.white)
                    Text("🔥")
                        .font(.system(size: 10))
                }
                .padding(.trailing, 4)
            } minimal: {
                // MARK: - Minimal View
                Text(context.attributes.icon)
                    .font(.system(size: 12))
            }
        }
    }

    private func formatValue(_ val: Double) -> String {
        return val.truncatingRemainder(dividingBy: 1) == 0 ? "\(Int(val))" : String(format: "%.1f", val)
    }
}

// MARK: - Lock Screen Presentation View
@available(iOS 16.1, *)
struct HabitLockScreenLiveActivityView: View {
    let attributes: HabitActivityAttributes
    let state: HabitActivityAttributes.ContentState

    var body: some View {
        HStack(spacing: 14) {
            // Icon Pill
            ZStack {
                Circle()
                    .fill(Color(red: 0.1, green: 0.12, blue: 0.15))
                    .frame(width: 44, height: 44)
                Text(attributes.icon)
                    .font(.system(size: 22))
            }

            // Habit Details & Progress
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(attributes.habitName)
                        .font(.system(size: 16, weight: .bold))
                        .foregroundColor(.white)
                    Spacer()
                    HStack(spacing: 3) {
                        Text("🔥")
                            .font(.system(size: 12))
                        Text("\(state.streak)d streak")
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundColor(.orange)
                    }
                }

                // Progress Bar
                GeometryReader { geo in
                    let progress = min(1.0, max(0.0, state.targetValue > 0 ? state.currentValue / state.targetValue : 0.0))
                    ZStack(alignment: .leading) {
                        RoundedRectangle(cornerRadius: 4)
                            .fill(Color.white.opacity(0.15))
                            .frame(height: 6)
                        RoundedRectangle(cornerRadius: 4)
                            .fill(Color(red: 0.06, green: 0.72, blue: 0.51))
                            .frame(width: geo.size.width * CGFloat(progress), height: 6)
                    }
                }
                .frame(height: 6)

                // Subtitle: Today's numbers + Partner sync
                HStack {
                    Text("\(state.currentValue.formatted()) / \(state.targetValue.formatted()) \(state.unit)")
                        .font(.system(size: 12, weight: .medium))
                        .foregroundColor(.white.opacity(0.8))
                    Spacer()
                    if !state.partnerUsername.isEmpty {
                        Text("@\(state.partnerUsername): \(state.partnerProgressPercent)% done")
                            .font(.system(size: 11))
                            .foregroundColor(.white.opacity(0.6))
                    }
                }
            }
        }
        .padding(14)
        .background(Color(red: 0.07, green: 0.08, blue: 0.1))
    }
}

extension Color {
    static let amber = Color(red: 0.96, green: 0.62, blue: 0.04)
}
