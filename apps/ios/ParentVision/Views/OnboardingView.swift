import SwiftUI

public struct OnboardingView: View {
    @Binding public var isPresented: Bool

    public var body: some View {
        NavigationStack {
            VStack(spacing: 28) {
                Spacer()

                Image(systemName: "shield.checkered")
                    .resizable()
                    .scaledToFit()
                    .frame(width: 72, height: 72)
                    .foregroundColor(.indigo)

                VStack(spacing: 8) {
                    Text("Welcome to ParentVision")
                        .font(.title2)
                        .fontWeight(.bold)

                    Text("Transparent, Consent-Driven Parental Supervision")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                        .multilineTextAlignment(.center)
                }

                VStack(alignment: .leading, spacing: 20) {
                    FeatureRow(
                        icon: "video.badge.waveform",
                        title: "Live Screen Broadcast",
                        description: "Parent can view live screen only after you confirm and initiate broadcasting via the system screen picker."
                    )

                    FeatureRow(
                        icon: "lock.shield",
                        title: "System Privacy Built-in",
                        description: "iOS automatically masks passwords and banking apps. The red status bar indicator is always visible during broadcast."
                    )

                    FeatureRow(
                        icon: "hourglass",
                        title: "Screen Time & Safeguards",
                        description: "Helps manage healthy screen habits and bedtime schedules using official Apple Screen Time controls."
                    )
                }
                .padding(.horizontal)

                Spacer()

                Button {
                    isPresented = false
                } label: {
                    Text("Continue to Enrollment")
                        .fontWeight(.semibold)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                        .background(Color.indigo)
                        .foregroundColor(.white)
                        .cornerRadius(14)
                }
                .padding(.horizontal)
            }
            .padding()
            .navigationBarTitleDisplayMode(.inline)
        }
    }
}

private struct FeatureRow: View {
    let icon: String
    let title: String
    let description: String

    var body: some View {
        HStack(alignment: .top, spacing: 14) {
            Image(systemName: icon)
                .font(.title3)
                .foregroundColor(.indigo)
                .frame(width: 32)

            VStack(alignment: .leading, spacing: 3) {
                Text(title)
                    .font(.callout)
                    .fontWeight(.semibold)

                Text(description)
                    .font(.footnote)
                    .foregroundColor(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }
}
