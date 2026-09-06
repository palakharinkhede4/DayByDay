//
//  HabitActivityAttributes.swift
//  DayByDay
//
//  ActivityKit Attributes definition for Dynamic Island & Lock Screen Live Activities
//

import ActivityKit
import Foundation

public struct HabitActivityAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        public var currentValue: Double
        public var targetValue: Double
        public var unit: String
        public var streak: Int
        public var isCompleted: Bool
        public var partnerProgressPercent: Int
        public var partnerUsername: String
        public var podSyncPercent: Int
        public var statusMessage: String
        public var lastUpdated: Date

        public init(
            currentValue: Double,
            targetValue: Double,
            unit: String,
            streak: Int,
            isCompleted: Bool,
            partnerProgressPercent: Int,
            partnerUsername: String,
            podSyncPercent: Int,
            statusMessage: String,
            lastUpdated: Date = Date()
        ) {
            self.currentValue = currentValue
            self.targetValue = targetValue
            self.unit = unit
            self.streak = streak
            self.isCompleted = isCompleted
            self.partnerProgressPercent = partnerProgressPercent
            self.partnerUsername = partnerUsername
            self.podSyncPercent = podSyncPercent
            self.statusMessage = statusMessage
            self.lastUpdated = lastUpdated
        }
    }

    // Static habit attributes
    public var habitId: String
    public var habitName: String
    public var category: String
    public var icon: String

    public init(habitId: String, habitName: String, category: String, icon: String) {
        self.habitId = habitId
        self.habitName = habitName
        self.category = category
        self.icon = icon
    }
}
